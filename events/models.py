from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


class Event(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    tagline = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    hero_headline = models.TextField(
        blank=True,
        help_text='Big headline on the landing page. One line per row (each row is shown on its own line). Leave blank to use the default.',
    )

    date = models.DateField()
    time = models.TimeField()
    place = models.CharField(max_length=200)
    city = models.CharField(max_length=100, blank=True)
    location_url = models.URLField(
        blank=True,
        help_text='Link to the venue on a map (Google Maps, Yandex Maps, etc.). When set, the place name on the site links here.',
    )

    hero_photo = models.ImageField(upload_to='events/hero/', blank=True, null=True)

    guest_price = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    startup_price = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    currency = models.CharField(max_length=10, default='UZS')

    capacity = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True, verbose_name=_('Current event'))

    startup_registration_open = models.BooleanField(
        default=True, verbose_name=_('Startup registration open'),
        help_text=_('When off, startups cannot apply and the option is hidden from visitors.'),
    )
    guest_registration_open = models.BooleanField(
        default=True, verbose_name=_('Guest registration open'),
        help_text=_('When off, guests cannot apply and the option is hidden from visitors.'),
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'time']

    def __str__(self):
        return f'{self.title} ({self.date})'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


class Application(models.Model):
    STARTUP = 'startup'
    GUEST = 'guest'
    TYPE_CHOICES = [
        (STARTUP, _('Startup')),
        (GUEST, _('Guest')),
    ]

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_APPROVED, _('Approved')),
        (STATUS_REJECTED, _('Rejected')),
    ]

    # Hard cap on guest applications per event (non-rejected).
    GUEST_CAP = 50

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='applications')
    applicant_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    telegram = models.CharField(max_length=100, blank=True)

    # startup-only fields
    project = models.CharField(max_length=150, blank=True)
    link = models.CharField(
        max_length=300, blank=True,
        help_text='Must be a public link (no login/access request) — private links cannot be opened during review.',
    )
    pitch = models.TextField(blank=True)

    # guest-only fields
    company = models.CharField(max_length=150, blank=True)
    why = models.TextField(blank=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} → {self.event} ({self.get_applicant_type_display()})'


class Subscriber(models.Model):
    """Email left on the between-events waitlist form."""

    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email
