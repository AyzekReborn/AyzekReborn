# TODO

What needs to be done

## API support

- Telegram

## Attachment system

Currently, attachment storage is recreated on every event

In future, we need to create attachment storage on first event, and recreate for
all users/chats on attachment list change (I.e plugin update/reload)

## Events

Currently only command events are passed to plugins, but there is more supported
by apis
