from django.contrib import admin
from modeltranslation.admin import TranslationAdmin
from unfold.admin import ModelAdmin, TabularInline

from .models import Application, Event, Subscriber


class ApplicationInline(TabularInline):
    model = Application
    extra = 0
    fields = ('name', 'email', 'applicant_type', 'status', 'created_at')
    readonly_fields = ('created_at',)
    show_change_link = True


@admin.register(Event)
class EventAdmin(TranslationAdmin, ModelAdmin):
    list_display = ('title', 'date', 'time', 'place', 'is_active', 'application_count')
    list_filter = ('is_active', 'date')
    search_fields = ('title', 'place', 'city')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'date'
    fields = (
        'title', 'slug', 'tagline', 'description', 'hero_headline',
        'date', 'time', 'place', 'city', 'location_url',
        'hero_photo',
        'guest_price', 'startup_price', 'currency',
        'capacity', 'is_active',
    )
    inlines = [ApplicationInline]

    @admin.display(description='Applications')
    def application_count(self, obj):
        return obj.applications.count()


@admin.register(Application)
class ApplicationAdmin(ModelAdmin):
    list_display = ('name', 'email', 'phone', 'telegram', 'event', 'applicant_type', 'status', 'created_at')
    list_filter = ('status', 'applicant_type', 'event')
    search_fields = ('name', 'email', 'phone', 'telegram', 'project', 'company')
    list_editable = ('status',)
    readonly_fields = ('created_at',)
    autocomplete_fields = ('event',)


@admin.register(Subscriber)
class SubscriberAdmin(ModelAdmin):
    list_display = ('email', 'created_at')
    search_fields = ('email',)
    readonly_fields = ('created_at',)
