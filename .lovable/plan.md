# Fix: login not working

## What's wrong

Login isn't failing because of a bug in your app. Your hosted database and login service are currently **paused**, so every request from the app — sign-in, reviews, updates on the home page — fails with a connection error.

Evidence:
- The sign-in request to the login service returned a network error, not a "wrong password" message.
- Two data requests from the landing page (reviews, updates) failed the same way.
- A backend health check reports the hosted database as paused.

## The fix

1. Resume the paused backend.
2. Wait until it reports healthy (starting up takes a minute or two).
3. Re-test sign-in with your admin account and confirm the landing page data loads again.

No code changes are needed. If sign-in still fails after the backend is healthy, the next step is to check the login logs for a real credential error and report back.

## Notes

Free/idle backends can pause automatically after a period of inactivity. If this keeps happening, we can discuss keeping it warm or upgrading.
