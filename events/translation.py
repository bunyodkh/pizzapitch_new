from modeltranslation.translator import TranslationOptions, register

from .models import Event, Expert


@register(Event)
class EventTranslationOptions(TranslationOptions):
    fields = ('title', 'tagline', 'description', 'hero_headline', 'place', 'city')


@register(Expert)
class ExpertTranslationOptions(TranslationOptions):
    fields = ('name', 'position')
