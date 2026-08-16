from django.conf import settings


def site(request):
    """Makes SITE_URL available to every template (used by base.html's SEO tags)."""
    return {'SITE_URL': settings.SITE_URL}
