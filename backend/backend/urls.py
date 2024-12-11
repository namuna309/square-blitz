from django.contrib import admin
from django.urls import path
from frontend.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index, name='index'),  # React 앱의 엔트리 포인트
]
