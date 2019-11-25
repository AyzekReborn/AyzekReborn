# TODO

What needs to be done

## API support

From old ayzek:

- [ ] Telegram
- [ ] IRC

Misc

- [ ] Plugin defined APIs

## Attachment system

~~Currently, attachment storage is recreated on every event~~

~~In future, we need to create attachment storage on first event, and recreate for all users/chats on attachment list change (I.e plugin update/reload)~~
Caching at AttachmentCreator level is fine too

## Events

Currently only command events are passed to plugins, but there is more supported
by apis

- [x] Plain message
- [ ] Error display
- [ ] Typing state
