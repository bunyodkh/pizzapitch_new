import html
import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TELEGRAM_API_URL = 'https://api.telegram.org/bot{token}/sendMessage'
TELEGRAM_TIMEOUT = 10  # seconds
TELEGRAM_MAX_ATTEMPTS = 3
TELEGRAM_RETRY_BACKOFF = 1.5  # seconds; doubles each retry

DIVIDER = '─' * 18

STARTUP = 'startup'
GUEST = 'guest'

# (emoji, label) per applicant_type — matches Application.STARTUP/GUEST.
TYPE_LABELS = {
    STARTUP: ('🚀', 'Стартап'),
    GUEST: ('🎉', 'Гость'),
}

# (emoji, label, field name) — field name is looked up on the passed-in
# application via attribute or dict-key access; anything missing/empty
# is silently skipped instead of printing an empty line.
CLIENT_FIELDS = [
    ('🙋', 'Имя', 'name'),
    ('📱', 'Телефон', 'phone'),
    ('📧', 'Email', 'email'),
    ('💬', 'Telegram', 'telegram'),
]
STARTUP_FIELDS = [
    ('💡', 'Проект', 'project'),
    ('🔗', 'Питч-дек', 'link'),
]
GUEST_FIELDS = [
    ('🏢', 'Компания', 'company'),
]


def _get(application, key, default=None):
    """Read `key` off a dict or an arbitrary object (e.g. a model instance)."""
    if isinstance(application, dict):
        return application.get(key, default)
    return getattr(application, key, default)


def _escaped(application, key):
    """Fetch `key` and HTML-escape it; returns None for missing/blank values
    so callers can skip the line entirely instead of rendering it empty."""
    value = _get(application, key)
    if value in (None, ''):
        return None
    return html.escape(str(value)).strip() or None


def _render_block(application, fields):
    lines = []
    for emoji, label, key in fields:
        value = _escaped(application, key)
        if value:
            lines.append(f'{emoji} <b>{label}:</b> {value}')
    return lines


def _build_message(application):
    applicant_type = _get(application, 'applicant_type')
    type_emoji, type_label = TYPE_LABELS.get(applicant_type, ('🎫', applicant_type or '—'))

    lines = [f'{type_emoji} <b>Новая заявка — {type_label}!</b>']

    event = _escaped(application, 'event')
    if event:
        lines.append(f'🎟️ <b>Мероприятие:</b> {event}')

    created_at = _get(application, 'created_at') or _get(application, 'created')
    if created_at is not None:
        formatted = created_at.strftime('%d.%m.%Y %H:%M') if hasattr(created_at, 'strftime') else str(created_at)
        lines.append(f'🕒 <b>Дата:</b> {html.escape(formatted)}')

    client_lines = _render_block(application, CLIENT_FIELDS)
    if client_lines:
        lines.append(DIVIDER)
        lines.extend(client_lines)

    type_fields = {STARTUP: STARTUP_FIELDS, GUEST: GUEST_FIELDS}.get(applicant_type, STARTUP_FIELDS + GUEST_FIELDS)
    type_lines = _render_block(application, type_fields)
    if type_lines:
        lines.append(DIVIDER)
        lines.extend(type_lines)

    # Free-text fields get their own line instead of being squeezed next to a label.
    pitch = _escaped(application, 'pitch')
    if applicant_type != GUEST and pitch:
        lines.append(DIVIDER)
        lines.append(f'🎤 <b>Питч:</b>\n{pitch}')

    why = _escaped(application, 'why')
    if applicant_type != STARTUP and why:
        lines.append(DIVIDER)
        lines.append(f'💭 <b>Почему хочет прийти:</b>\n{why}')

    return '\n'.join(lines)


def _looks_like_group_id(chat_id):
    """Telegram group/supergroup chat IDs are negative numbers (supergroups
    start with -100); a positive ID is a private one-on-one chat, not a
    group. This is only used for a soft warning, never to block sending —
    channels and edge cases can still be legitimate negative/other IDs."""
    try:
        return int(chat_id) < 0
    except (TypeError, ValueError):
        return False


def _send_group_message(text, *, bot_token=None, group_chat_id=None):
    """
    Low-level send: POSTs `text` (HTML parse mode) to the configured GROUP
    chat. Shared by every notify_* helper below.

    Never raises: a Telegram outage or missing config must not break the
    request that triggered the notification. Returns True on success,
    False otherwise (check the logs for the reason).
    """
    bot_token = bot_token or getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    group_chat_id = group_chat_id or getattr(settings, 'TELEGRAM_GROUP_CHAT_ID', None)
    if not bot_token or not group_chat_id:
        logger.warning('Telegram notification skipped: TELEGRAM_BOT_TOKEN/TELEGRAM_GROUP_CHAT_ID not configured.')
        return False

    if not _looks_like_group_id(group_chat_id):
        logger.warning(
            'TELEGRAM_GROUP_CHAT_ID (%s) does not look like a group chat ID (groups are negative, '
            'supergroups start with -100) — double-check this is the group, not the bot\'s own chat.',
            group_chat_id,
        )

    backoff = TELEGRAM_RETRY_BACKOFF
    for attempt in range(1, TELEGRAM_MAX_ATTEMPTS + 1):
        try:
            response = requests.post(
                TELEGRAM_API_URL.format(token=bot_token),
                json={
                    'chat_id': group_chat_id,
                    'text': text,
                    'parse_mode': 'HTML',
                    'disable_web_page_preview': True,
                },
                timeout=TELEGRAM_TIMEOUT,
            )
            if response.status_code >= 400 and response.status_code not in (429, 500, 502, 503, 504):
                # Permanent client error (bad token, bad chat id, malformed request, etc.) —
                # retrying won't help, fail immediately instead of burning the backoff budget.
                logger.error(
                    'Telegram API rejected the notification (HTTP %d): %s',
                    response.status_code, response.text,
                )
                return False
            response.raise_for_status()
            payload = response.json()
            if not payload.get('ok'):
                logger.error('Telegram API rejected the notification: %s', payload)
                return False

            result_chat = payload.get('result', {}).get('chat', {})
            if result_chat.get('type') not in ('group', 'supergroup'):
                logger.warning(
                    'Telegram message was sent, but the target chat type is "%s", not a group — '
                    'check TELEGRAM_GROUP_CHAT_ID.',
                    result_chat.get('type'),
                )
            return True
        except requests.RequestException:
            if attempt < TELEGRAM_MAX_ATTEMPTS:
                logger.warning(
                    'Telegram notification attempt %d/%d failed (network/API error), retrying in %.1fs.',
                    attempt, TELEGRAM_MAX_ATTEMPTS, backoff, exc_info=True,
                )
                time.sleep(backoff)
                backoff *= 2
            else:
                logger.exception('Failed to send Telegram notification (network/API error).')
                return False


def notify_new_application_telegram(application, *, bot_token=None, group_chat_id=None):
    """
    Send a Telegram notification about a new site application/lead to a
    GROUP chat (not a private chat with the bot).

    `application` can be a dict or any object (e.g. an Application model
    instance) — fields are read via key or attribute access, whichever
    applies. Common fields: event, created_at/created, applicant_type
    ('startup' or 'guest'), name, phone, email, telegram. Fields shown only
    for the matching applicant_type: project, link (pitch deck),
    pitch — for startups; company, why — for guests. Any field that's
    missing or empty is simply left out of the message rather than raising.

    `bot_token` — the bot's token from @BotFather. It authenticates as the
    bot regardless of which chat is targeted; it is not specific to any group.

    `group_chat_id` — the numeric ID of the target GROUP chat (the bot must
    already be a member of that group). Group/supergroup IDs are negative.

    Both default to settings.TELEGRAM_BOT_TOKEN / settings.TELEGRAM_GROUP_CHAT_ID
    unless overridden via the keyword arguments.

    Never raises — see `_send_group_message`. Returns True on success.
    """
    try:
        text = _build_message(application)
    except Exception:
        logger.exception('Failed to build Telegram notification text.')
        return False
    return _send_group_message(text, bot_token=bot_token, group_chat_id=group_chat_id)


def notify_new_subscriber_telegram(subscriber, *, bot_token=None, group_chat_id=None):
    """
    Send a Telegram notification about a new between-events waitlist
    subscriber to the GROUP chat. `subscriber` can be a dict or any object
    (e.g. a Subscriber model instance) with `email` and, optionally,
    `created_at` fields.

    Same config/behavior as `notify_new_application_telegram` — see there
    for `bot_token` / `group_chat_id`. Never raises. Returns True on success.
    """
    email = _escaped(subscriber, 'email')
    if not email:
        logger.warning('Telegram subscriber notification skipped: missing email.')
        return False

    lines = ['📬 <b>Новый подписчик на рассылку!</b>', f'📧 <b>Email:</b> {email}']
    created_at = _get(subscriber, 'created_at')
    if created_at is not None:
        formatted = created_at.strftime('%d.%m.%Y %H:%M') if hasattr(created_at, 'strftime') else str(created_at)
        lines.append(f'🕒 <b>Дата:</b> {html.escape(formatted)}')

    return _send_group_message('\n'.join(lines), bot_token=bot_token, group_chat_id=group_chat_id)


def notify_new_partner_inquiry_telegram(inquiry, *, bot_token=None, group_chat_id=None):
    """
    Send a Telegram notification about a new "become a partner" lead to the
    GROUP chat. `inquiry` can be a dict or any object (e.g. a PartnerInquiry
    model instance) with `email`, `message` and, optionally, `created_at`.

    Same config/behavior as `notify_new_application_telegram` — see there
    for `bot_token` / `group_chat_id`. Never raises. Returns True on success.
    """
    email = _escaped(inquiry, 'email')
    if not email:
        logger.warning('Telegram partner inquiry notification skipped: missing email.')
        return False

    lines = ['🤝 <b>Новая заявка от партнёра!</b>', f'📧 <b>Email:</b> {email}']
    created_at = _get(inquiry, 'created_at')
    if created_at is not None:
        formatted = created_at.strftime('%d.%m.%Y %H:%M') if hasattr(created_at, 'strftime') else str(created_at)
        lines.append(f'🕒 <b>Дата:</b> {html.escape(formatted)}')

    message = _escaped(inquiry, 'message')
    if message:
        lines.append(DIVIDER)
        lines.append(f'💬 <b>Сообщение:</b>\n{message}')

    return _send_group_message('\n'.join(lines), bot_token=bot_token, group_chat_id=group_chat_id)
