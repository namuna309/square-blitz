#!/bin/sh

# 네트워크 Gateway IP 가져오기
NETWORK_GATEWAY=$(docker network inspect square-blitz_monitoring -f '{{(index .IPAM.Config 0).Gateway}}')

# .env 파일에서 기존 PROMETHEUS_IP 값 제거
sed -i '/^DOCKER_GATEWAY=/d' /.env

# .env 파일에 새 PROMETHEUS_IP 값 추가 (Gateway IP 사용)
echo "DOCKER_GATEWAY=$NETWORK_GATEWAY" >> /.env

echo "Updated .env with DOCKER_GATEWAY=$NETWORK_GATEWAY"


