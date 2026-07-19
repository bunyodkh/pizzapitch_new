"""
The Django build vendored in this project ships an incomplete `ru` locale:
it's missing core translations Django normally provides for date formatting
(weekday/month abbreviations used by the `date` template filter, e.g.
"D, d M" rendering as "Thu, 30 Jul" instead of a Russian date).

`gettext_noop` here doesn't translate anything itself — it just marks these
exact strings so `makemessages` keeps finding and preserving them as used.
The real translations live in locale/ru/LC_MESSAGES/django.po; because
LOCALE_PATHS catalogs are merged with highest priority, our entries for
these msgids override the (missing) ones from Django's own locale, and
Django's own dateformat code picks them up automatically — nothing here
needs to be imported or called at runtime.
"""
from django.utils.translation import gettext_noop as _

_WEEKDAYS_ABBR_AND_MONTHS_3 = [
    # WEEKDAYS_ABBR (django.utils.dates) — used by the "D" date format.
    _('Mon'), _('Tue'), _('Wed'), _('Thu'), _('Fri'), _('Sat'), _('Sun'),
    # MONTHS_3 (django.utils.dates) — used by the "M" date format.
    _('jan'), _('feb'), _('mar'), _('apr'), _('may'), _('jun'),
    _('jul'), _('aug'), _('sep'), _('oct'), _('nov'), _('dec'),
]
