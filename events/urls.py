from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('apply/', views.apply, name='apply'),
    path('subscribe/', views.subscribe, name='subscribe'),
    path('partners/inquiry/', views.partner_inquiry, name='partner_inquiry'),
    path('team/login/', views.TeamLoginView.as_view(), name='team_login'),
    path('team/logout/', views.TeamLogoutView.as_view(), name='team_logout'),
    path('team/', views.team_home, name='team_home'),
    path('team/events/', views.event_list, name='event_list'),
    path('team/events/new/', views.event_create, name='event_create'),
    path('team/events/<int:event_id>/edit/', views.event_edit, name='event_edit'),
    path('team/events/<int:event_id>/delete/', views.event_delete, name='event_delete'),
    path('team/experts/', views.expert_list, name='expert_list'),
    path('team/experts/new/', views.expert_create, name='expert_create'),
    path('team/experts/<int:expert_id>/edit/', views.expert_edit, name='expert_edit'),
    path('team/experts/<int:expert_id>/delete/', views.expert_delete, name='expert_delete'),
    path('team/partners/', views.partner_list, name='partner_list'),
    path('team/partners/new/', views.partner_create, name='partner_create'),
    path('team/partners/<int:partner_id>/edit/', views.partner_edit, name='partner_edit'),
    path('team/partners/<int:partner_id>/delete/', views.partner_delete, name='partner_delete'),
    path('team/participants/', views.participants, name='participants'),
    path('team/participants/export/', views.participants_export_csv, name='participants_export_csv'),
    path('team/participants/export/excel/', views.participants_export_excel, name='participants_export_excel'),
    path('team/participants/<int:app_id>/status/', views.set_application_status, name='set_application_status'),
    path('team/contacts/', views.contacts, name='contacts'),
    path('team/contacts/export/', views.contacts_export, name='contacts_export'),
    path('team/contacts/export/excel/', views.contacts_export_excel, name='contacts_export_excel'),
]
