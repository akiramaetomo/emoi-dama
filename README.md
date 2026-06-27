# emoi-dama / えもい玉

[日本語版 README](README.ja.md)

**Keep a small moment of feeling as a ball.**<br>
**When you look back, it can shine beautifully.**

`emoi-dama` / `えもい玉` is an everyday calendar-and-memo app that gives a
tactile presence to small emotional moments.

Good food. A clear sky. A parent sounding well on a call. A little relief at
the end of the day. A moment too small for a long explanation, but real enough
to have moved you. emoi-dama lets that moment remain near you as a colored
ball.

The app also cares about its own emoi feeling: it should be something you want
to touch again.

Open the prototype:

```text
https://akiramaetomo.github.io/emoi-dama/
```

## Keep It As A Ball

A ball is a small charm. It is not just a recording tool. You can see it, touch
it, look back at it later, and sometimes entrust it quietly to someone
important.

The concrete details of an event may stay with the person. But the presence of
the feeling, the sense that something surely happened, can appear as a ball,
color, motion, and sound. It can also become a paper-like `お預け状` or
`預かり証`. This separation is the key to the psychological safety of
emoi-dama.

## Entrusting And Keeping

emoi-dama lets a ball be entrusted to someone, or kept for someone. This idea of
`預かり`, keeping a small feeling on someone's behalf, is one of the app's
original concepts.

A feeling is not separated from the person who felt it. So a ball is not a gift
to give away, a thing to distribute, or a token to scatter like money. It is a
small object kept with the understanding that the feeling still belongs to the
person whose moment it was.

## What It Is For

emoi-dama is for looking back at small traces of emoi feeling that happened in
ordinary life.

Not everything belongs on social media. Not everything needs to be told to
someone. A tiny laugh, a tiny moment of beauty, a small relief, a light
tiredness. These small things are worth keeping too.

When you look back and think, "What was I even saying?", open the ball. That
moment may be a little emoi too.

emoi-dama is not a happiness-achievement app, an emotional venting tool, a
positive-or-negative posting social network, a shared diary platform, or a
religious practice.

It keeps distance from rankings, likes, followers, streak pressure, and the
feeling that emotion must be polished for approval. One meaningful ball matters
more than collecting many balls.

## Current Prototype

The current prototype runs entirely in the browser.

- Create and keep small emotional moments as balls.
- Roll, grab, flick, and hear the balls.
- Inspect and edit ball contents.
- Revisit memories from the calendar.
- Show paper-like `お預け状` / `預かり証` previews.
- Exchange one-ball URL packets without a server database.
- Export and import JSON for manual backup and review.

Prototype safety notes:

- Data is stored only in the current browser's local storage.
- There is no server database, account system, analytics, advertising, or public
  timeline.
- Do not enter sensitive personal information during early testing.
- URL and JSON features are prototype transfer tools, not a durable backup
  service.

## Start Here

1. Open the app.
2. When something feels emoi, press the `+` mark and create one ball.
3. Flick it lightly and try its motion and sound.
4. Tap a ball when you want to inspect its contents.
5. Use the calendar to browse balls. You can show balls from multiple days at
   once.
6. When you want to pass a ball to someone, create an `お預け状` URL and send it
   through LINE or another message app.

## Development

This repository is the public GitHub Pages target for the early Web prototype.
The normal development repository is separate.

```powershell
npm install
npm test
npm run build
npm run dev
```

The Pages workflow builds the static Vite app and publishes the generated
artifact for:

```text
https://akiramaetomo.github.io/emoi-dama/
```
