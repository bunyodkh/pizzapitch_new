from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from .models import Event


class TeamAuthenticationForm(AuthenticationForm):
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not user.is_staff:
            raise ValidationError(
                _('This account does not have access to the team dashboard.'),
                code='not_staff',
            )


class EventForm(forms.ModelForm):
    # Not a model field — a UI-only flag the view uses to clear hero_photo,
    # since a bare FileInput never submits a "clear this" signal on its own.
    remove_hero_photo = forms.BooleanField(required=False, widget=forms.HiddenInput)

    class Meta:
        model = Event
        fields = [
            'title_en', 'title_ru',
            'tagline_en', 'tagline_ru',
            'description_en', 'description_ru',
            'date', 'time',
            'place_en', 'place_ru', 'city_en', 'city_ru', 'location_url',
            'hero_photo',
            'startup_price', 'currency',
            'capacity', 'is_active',
            'startup_registration_open', 'guest_registration_open',
        ]
        widgets = {
            'date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
            'time': forms.TimeInput(attrs={'type': 'time'}, format='%H:%M'),
            'description_en': forms.Textarea(attrs={'rows': 4}),
            'description_ru': forms.Textarea(attrs={'rows': 4}),
            'location_url': forms.URLInput(attrs={'placeholder': 'https://maps.google.com/...'}),
            'hero_photo': forms.FileInput,
        }
        labels = {
            'title_en': _('Title'),
            'title_ru': _('Title'),
            'tagline_en': _('Tagline'),
            'tagline_ru': _('Tagline'),
            'description_en': _('Description'),
            'description_ru': _('Description'),
            'place_en': _('Place'),
            'place_ru': _('Place'),
            'city_en': _('City'),
            'city_ru': _('City'),
            'location_url': _('Map link'),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['date'].input_formats = ['%Y-%m-%d']
        self.fields['time'].input_formats = ['%H:%M']
        # Modeltranslation makes every language column nullable at the DB level;
        # require the default-language title/place so an event can't save without them.
        self.fields['title_en'].required = True
        self.fields['place_en'].required = True
