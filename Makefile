COMPOSE = docker-compose

install:
	$(COMPOSE) build $(BUILDFLAGS)
	$(COMPOSE) run shell npm install
	$(COMPOSE) run shell npm rebuild

reinstall:
	rm -rf node_modules
	yes | $(COMPOSE) rm --all
	$(MAKE) install BUILDFLAGS="--no-cache --pull"

shell:
	$(COMPOSE) run shell

.PHONY: install reinstall shell
