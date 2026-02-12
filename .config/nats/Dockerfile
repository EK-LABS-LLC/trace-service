FROM natsio/nats-box:latest as cli

FROM nats:2.10-alpine
COPY --from=cli /usr/local/bin/nats /usr/local/bin/nats
ENTRYPOINT ["/bin/sh", "/etc/nats/start-nats.sh"]
