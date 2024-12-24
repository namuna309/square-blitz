#!/bin/sh

# Prometheus 컨테이너의 IP 가져오기
PROMETHEUS_IP=$(getent hosts prometheus | awk '{ print $1 }')

# .env 파일에서 기존 PROMETHEUS_IP 값 제거
sed -i '/^PROMETHEUS_IP=/d' .env

# .env 파일에 새 PROMETHEUS_IP 값 추가
echo "PROMETHEUS_IP=$PROMETHEUS_IP" >> .env

echo "Updated .env with PROMETHEUS_IP=$PROMETHEUS_IP"

