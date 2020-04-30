FROM alpine:3.11

# .ssh/config is insecure, but ok in firewalled environment
RUN apk add --no-cache yarn fish openssh-client git && \
	adduser -D -S ayzek && mkdir /ayzek/ && chown ayzek:users /ayzek/

# TODO: Better security
# USER ayzek
WORKDIR /ayzek

ADD . /ayzek/
RUN mkdir /ayzek/node_modules

RUN mkdir ~/.ssh && \
	yarn policies set-version berry && \
	yarn set version latest && \
	echo "nodeLinker: node-modules" >> .yarnrc.yml

VOLUME [ "/ayzek/node_modules" ]

ENTRYPOINT [ "scripts/docker-entry.fish" ]
