# Hit Your Shot: Design Rules

Art direction, interface rules, motion rules and the writing voice for the game. Every screen, asset and line of text is checked against this file. It is written for two readers: the people and agents who build the game, and the owner, who is not a designer but can tell when something feels generated. Each section ends with **Why**, in plain words, so the owner can judge the decision and not only the result.

The one-sentence version: **a calm world, one loud thing, thick outlines, deadpan jokes, and at least one deliberately odd choice on every screen.**

---

## 1. What this game looks like, in one paragraph

A cheerful, slightly stupid sports game. Flat, chunky, cut-out shapes with thick dark outlines, like stickers on a poster. Soft, hazy backgrounds with very little detail. One saturated color on screen at a time, and it belongs to the thing that matters right now: the ball, the target, the button you should press. Big rounded letters with an outline for anything the player must read in one glance. A character with a face that reacts. Nothing glows, nothing is glass, nothing floats on a purple gradient.

## 2. What we take from the three reference screenshots

The owner provided three screenshots of games with a look that feels right. This is what we take and what we leave.

**Reference 1: the rooftop shooter (pixel-ish character, three upgrade cards).**
Take: the calm, desaturated city haze behind the action; one color per upgrade card; the big rounded outlined font; the level pips under each card; the drawn hand and two-word tutorial; the upgrade button that shows the price on the button itself.
Leave: the character. A bald, featureless man in a white shirt is the stock character of this genre, and the pixel art clashes with the smooth vector interface around it. Also leave the three identical cards with generic icons (bullet, clock, coins): that layout is correct, but the icons are what everyone uses.

**Reference 2: the yellow car on the green track (low-poly 3D).**
Take: the color discipline. The world is soft pastel green and grey; the car is the only saturated thing and it is bright yellow. Strong single light, long soft shadows, lots of empty space. Nothing competes with the hero object.
Leave: 3D. Consistent 3D needs a modelling and lighting pipeline we do not have, and inconsistent 3D looks worse than consistent 2D.

**Reference 3: "Explore new worlds" (lettering over low-poly scenes).**
Take: the title lettering. White with a warm yellow fill at the bottom, thick dark outline, slight tilt, large. This is our display style for the few words that matter (sport names, "NEW!", round results).
Leave: splitting the screen into two scenes, and the heavy drop shadow under everything.

**Why:** the three references agree on one thing: a quiet world with one loud object. That is the part worth copying. The surface (pixels, polygons) is incidental and we choose the surface we can produce consistently.

## 3. The art technique: flat cut-out with thick outlines

- Shapes are flat fills with a dark outline of constant width (3 px at 1× on phones, scaled with the asset). No gradients inside shapes, except a single two-tone split (light top, darker bottom) on round things like balls, to show volume.
- Characters, balls, targets and props are drawn as vector shapes (SVG, or Skia paths generated from code). No raster sprites, no pixel art, no 3D renders, no photos.
- Backgrounds are simplified silhouettes in two or three steps of the same hue, lighter and bluer toward the back (the haze in reference 1). No detail in backgrounds. A background that could be described in one sentence is correct.
- Shadows under world objects are a flat dark ellipse, no blur. **Interface elements cast no shadow** (owner decision 2026-11-15: a drop shadow under an outlined button read as a thicker bottom outline). Every outline is the same width on every side: 3 px on cards, buttons, pills and balls alike.
- Rounded corners on interface elements are large (20 px cards, 16 px buttons, full pill for tags). Corners on world objects follow the object: a goal post is square.

**Why:** this style is produced by code and by agents with the same result every time, it scales to every screen, and it survives being drawn in a hurry. It is also the only style where a character with four arms still reads clearly at phone size. Gradients, blur and glow are what generated interfaces reach for first, so we simply do not have them available.

## 4. Color

Tokens (to be copied into the theme file when code starts). Names describe the job, not the color.

| Token | Hex | Job |
|---|---|---|
| `ink` | `#1F2430` | every outline, every text on a fill, hard shadows |
| `paper` | `#FFF7E8` | cards, result panel, speech bubbles |
| `paper2` | `#F1E6CF` | wells, tracks, disabled fills |
| `sky` | `#C9DCE8` | the default world background top |
| `haze` | `#A9C2D4` | silhouettes in the far background |
| `accent` | `#FF8A3D` | the one action button, the aiming line, "you should press this" |
| `cash` | `#FFC83D` | money and only money |
| `good` | `#5CC96A` | a hit, a success toast, a maxed bar |
| `bad` | `#E8564B` | a miss marker, a destructive confirmation |
| `arm` | `#B07CF0` | reserved: anything about characters and arms, so the reveal has its own color |

Per-sport world colors (background and target), one hue family each:

| Sport | World | Target highlight |
|---|---|---|
| Basketball | warm gym: `#E9D8B8` floor, `#C9DCE8` sky through windows | rim `#FF6B3D`, net `paper` |
| Golf | fairway greens: `#9BD47A` near, `#C7E6B0` far | flag `#E8564B` |
| Football | pitch `#86C96F`, grey stand `#B8C2CC` | net `paper`, posts `paper` |

Rules:

- On any screen at any moment, there is **one saturated hue** besides money. During play that hue is the ball or the target. Between rounds it is the upgrade button you can afford.
- Saturated colors are **fills**, with `ink` text on them. They are never used as text color on `paper`. Colored text on `paper` only in the two safe tints (`good` darkened to `#2F8A3C`, `bad` darkened to `#B83A31`).
- The three upgrade cards have **three different fill colors** (blue `#6FB7F0`, orange `accent`, green `good`), as in reference 1. This is the one place three saturated colors sit side by side, and only between rounds.
- No pure black, no pure white. `ink` is a dark blue-grey; `paper` is warm.
- No gradients in the interface. Gradients exist in exactly two places: the sky (two stops) and the display lettering (white to `cash`, bottom third).
- No purple-blue gradient, no neon, no "glass" (translucent white with blur), no glow around anything. These are banned, not discouraged.

**Why:** a calm background makes the ball and the money pop without effects. A fixed small palette means every screen looks like the same game. The purple-blue gradient, glass cards and glow are the signature of interfaces made without a decision, and people recognize it without knowing why. `arm` purple is reserved so the moment a new character appears, the color itself says "this is something else".

## 5. Typography

- **Display:** Lilita One (SIL Open Font License, free). Used for: sport names, "NEW!", the round result number, the price on a button. Always with an `ink` outline (text stroke 2 px, or a duplicated layer offset by 1 px in four directions), always short, never a sentence.
- **Interface:** Nunito (Open Font License). Weights: 700 for labels and numbers, 600 for body. No other weights.
- Numbers that change every frame (money during a round) sit left-aligned in a fixed-width box, so the text does not jump when digits change. Nunito has tabular figures; use them.
- ALL CAPS only in the display font, and only for one or two words. Labels and body are sentence case.
- Minimum sizes: 14 pt body, 16 pt labels on buttons, 28 pt display. Nothing on screen is smaller than 12 pt, ever, including the pips' tiny numbers, which do not exist.
- No Inter, Roboto, Poppins, Montserrat, SF Pro or system default anywhere. If a font is not installed, the screen is not finished.

**Why:** the display font carries the personality: round, heavy, a bit goofy. The interface font stays out of the way. Two fonts, two weights each, is enough and keeps every screen consistent. The banned list is simply the set of fonts that every generated interface defaults to, which is why they feel generated.

## 6. Layout

- Portrait only. Design at 375 × 812 pt and check at 360 × 740 (small Android) and 430 × 932 (large iPhone).
- Grid: 16 pt gutter, 8 pt base unit, 12 pt between cards. Touch targets at least 48 × 48 pt.
- The play field is the top 70% of the screen. The character stands **left of center**, at about 25% of the width, feet at about 65% of the height. The target is on the right. This asymmetry is intentional and must not be "fixed".
- Money sits top center in a `paper` pill with an `ink` outline. Nothing else is in the top bar during a round. Settings is a small ghost button top right.
- The upgrade cards sit in the bottom 30%: three cards, equal width, each with name, icon, pips, and one button that shows the price. The cards are always visible, but **buying happens only between rounds** (owner decision 2026-11-15): during a round every buy button is disabled. The button is `paper2` and flat when unaffordable or during a round, and filled when it can be pressed.
- Between rounds a result panel slides up **over the play field, not over the cards**, so the player reads the result and presses an upgrade without any navigation.
- Empty space is allowed and wanted. If a screen feels empty, that is the background's job to fix with haze, not the interface's job to fix with widgets.
- Every screen has **one odd choice**: something off-grid, oversized or tilted that a template would not do. The character off-center, the result number tilted 4 degrees, the "NEW!" tag hanging over the card edge. One per screen, never three.

**Why:** generated layouts center everything and fill every gap, because that is the average of all layouts. A human designer leaves room and puts the hero slightly off-center, because the eye reads left-to-right and wants somewhere to go. The "one odd choice" rule forces a decision on every screen; a decision is exactly what slop lacks.

## 7. Icons

- Icons are drawn for this game in the same cut-out style: flat fill, `ink` outline, one or two colors, 2 px detail minimum. Each upgrade icon is a small scene, not a symbol: accuracy is the ball going through the hoop with motion lines; fire rate is three balls in a row leaving a hand; income is a coin with a face.
- No emoji. No icon fonts. No generic line icons in a circle (Lucide, Feather, Material) in the game itself. In settings and legal screens, plain text labels beat generic icons.
- An icon and its label are never redundant: if the label says "Accuracy", the icon shows what accuracy *does*, not a crosshair.

**Why:** emoji and stock icons are the fastest way to make a screen look assembled rather than designed, and every player has seen them a thousand times. A drawn icon with a tiny joke in it is remembered.

## 8. The character

- One body shape, round head, dot eyes, a mouth that changes. Four expressions are enough: neutral, strain (heavy ball), surprise (wide eyes, small mouth), smug (half-closed eyes, small smile).
- The character is **not an athlete**. Slightly wrong clothes for the sport: socks with sandals on the golf course, a tie in the gym. One wrong item per character, not a costume.
- Idle: breathes (2% scale on the torso, 2.4 s loop). Nothing else loops.
- Shooting: anticipation (arm back, 80 ms), release (arm forward, ball leaves, 60 ms), settle (120 ms). Heavy balls stretch anticipation to 160 ms and add the strain face.
- Reacting: a miss that bounces back and hits the character gets the surprise face and a 3-frame shake. A perfect round gets smug. Reactions last under 600 ms and never block input.

Extra limbs (see `docs/game-design.md`; the limbs are a surprise). Each sport uses the body part the sport uses: arms in basketball and golf, **feet in football**. Every sport starts with one of that limb. Characters are per sport.

- **Limbs are procedural and uncapped.** The character is drawn by code, and limb *n* is placed by an algorithm, never by hand. The algorithm follows the body first and then stops being sensible: arms 1 and 2 at the shoulders, 3 from the middle of the back, 4 from the hip, then alternating sides down the torso and up the back, with a small deterministic variation in height, length and rest angle (from the limb index, not from randomness) so a crowd of limbs looks grown rather than stacked. Feet: 1 and 2 at the hips, 3 from the side of the torso, 4 from the back, then the same pattern; the character stands on whichever feet are not kicking. Outlines stay the same width at every count, limbs behind the body are drawn first and slightly darker, and nothing ever overlaps the face. The character never comments. The shop card never says "arms" or "feet". The card says the character's name and shows a silhouette with the limb count hidden behind the body.
- **Extreme volume looks like fun, not like a bug.** When hundreds of balls are in flight, they are drawn in one batch, keep their outline, bounce off rim, board, floor and walls, and pile up briefly on the floor before fading. No slow-motion, no screen shake, no warning. The commentator may notice ("That is a lot of ball.").
- The first time a new character walks in, the extra limb is **folded** (an arm against the body, a foot tucked behind the standing leg) and unfolds on the first shot. No fanfare text, no confetti. The commentator line (section 10) is the only acknowledgement.
- From limb 5 on, each new limb does something other than shoot once before shooting: an arm holds a drink, waves, scratches the head; a foot taps, stretches, or kicks the standing leg. Then it joins the line. This is the only place in the game where a gag is scripted rather than emergent.
- Football with one foot: the character hops. The hop is the walk cycle. It is slow, slightly undignified, and not fixed when more feet arrive; extra feet kick, they do not help walking.

**Why:** the arms are funny only if the game pretends they are normal. A banner saying "NEW ARM UNLOCKED!!!" turns a joke into a feature list. Deadpan is a design rule here, not a tone preference.

## 9. Motion

Everything the player does gets a reaction within 100 ms. Everything the game does to the player is readable in under 400 ms.

| Moment | What happens | Timing |
|---|---|---|
| Press a button | scales to 0.96 | 90 ms down, 160 ms up, spring with slight overshoot |
| Drag the aim line | line follows the finger with no smoothing; the spread cone follows | immediate |
| Ball leaves the hand | ball stretches 1.15 along the direction of travel for 2 frames | 40 ms |
| Hit | target reacts (net swish, flag wobble, net bulge), ball squashes 0.8, `+$` text flies up and fades, coin pops toward the money pill | reaction 200 ms, text 500 ms |
| Miss | ball bounces with correct physics, a small dust puff where it lands, no text | physics |
| Round ends | result panel slides up from behind the cards | 280 ms, ease-out, no bounce |
| Upgrade bought | the pip fills, the card icon pops 1.1, the button price updates with a count | 240 ms |
| New ball unlocked | the ball rolls in from the right and stops in front of the character | 600 ms |
| New character | walks in from the left (120 ms per step, 4 steps), stops, looks at the camera for 400 ms | about 900 ms |

Rules:

- Use springs (with a little overshoot) for things that respond to the player, and ease-out for things the game shows the player. Never ease-in-out for everything.
- Nothing loops forever except the character's breathing and the target's movement. No pulsing buttons, no shimmering, no particles idling in the background.
- Confetti exists for exactly two moments: the first 2-arm character, and finishing a sport. Nowhere else.
- Reduce Motion (phone setting) turns off scale and slide; fades remain.
- Haptics: light tap on button press, a soft "tick" per hit, one medium on a new best round, one heavy when a character walks in. Never per shot; shots are too frequent.

**Why:** generated games animate everything the same way (ease-in-out, 300 ms, forever pulsing), which turns motion into noise. A few distinct, short, physical reactions make the game feel like it has weight. The confetti budget is a budget on purpose: a celebration you see every minute is not a celebration.

## 10. Writing voice

The game talks in two places: a sports commentator who comments on the round result, and the shop and interface labels. Nobody else speaks. The character has no lines.

The commentator:

- Deadpan, dry, professional, slightly tired. Treats everything, including the arms, as a normal sporting event.
- Lines are **at most eight words**. Most are under five.
- One line per round result, chosen from a pool by situation (perfect round, zero hits, new best, heavy ball barely moved, first time with 2 arms). A line is never shown twice in a row and no line appears more than once per session.
- Specific over general. "Three off the rim." beats "Nice try!". A number, an object or a body part makes a line specific.
- Never exclaims. One exclamation mark exists in the whole game: "NEW!" on a card.
- Never encourages. No "Keep going!", "You can do it!", "Almost there!".
- Never breaks the fourth wall, never mentions upgrades, money or the game.

Example pool (write more in this register; delete anything that sounds like it belongs on a motivational poster):

- "Textbook. Whose textbook, unclear."
- "Three off the rim. Rim is fine."
- "The ball did arrive, eventually."
- "A new personal best. Modest, but personal."
- "Zero for eleven. The hoop sends regards."
- "That one had opinions."
- "Both hands. Interesting choice." (first round with 2 arms)
- "The league has been informed." (first round with 3 arms)
- "No comment." (first round with 4 or more limbs)
- "Both feet. Still standing. Somehow." (first round with 2 feet in football)
- "Three feet. One ball. Fair." (first round with 3 feet)
- "Heavy ball. Heavy round."
- "Golf, allegedly."
- "Keeper never saw it. Keeper is a cone."
- "Wind: none. Excuses: none."
- "He is not getting tired. We checked."

Interface labels:

- Nouns and verbs, no adjectives. "Accuracy", "Fire rate", "Income", "Upgrade", "Play again". Not "Awesome upgrades", not "Super income boost".
- Prices on the button itself: a coin glyph and the number. No "Buy for".
- The shop card for a new character shows a name and a silhouette, nothing else. Names are ordinary: Doug, Petra, Lennart, Mo, Ingrid. No puns in names.
- Settings, privacy and purchase screens are written plainly and completely. Humor stops at the settings door.

Banned words and patterns anywhere in the game, store listing or marketing: epic, awesome, legendary, ultimate, insane, unleash, journey, experience, adventure awaits, "whether you're a ... or a ...", three adjectives in a row, a rhetorical question followed by an answer, an exclamation mark after a sentence that is not "NEW".

**Why:** humor written by generators is loud, punny and approving: it tells you it is funny. Human humor in a game like this is quiet and lets the picture do the work: a man with three arms, a commentator who refuses to notice. Short lines also fit the screen and the four-second attention budget of a round result. The banned list is the vocabulary of app store copy that nobody believes.

## 11. Sound

- Every hit has a sound; the sound is specific to the sport (swish, cup rattle, net thump). Every shot has a soft release sound. Misses make the physical sound of the surface they hit, nothing else.
- Round end: one short two-note phrase, the same every time. New best: a third note on top.
- A new character: footsteps, then nothing. The silence is the joke.
- No background music in version 1. Ambient sound per sport (gym echo, birds, distant crowd) at low volume.
- Sounds come from CC0 sources or are recorded; no stock "success chime" that every app uses.

**Why:** players mostly play muted, so sound must never carry information. When sound is on, specific physical sounds make the game feel like objects, while a generic chime makes it feel like a notification.

## 12. The "feels generated" checklist

Run before any screenshot goes into a PR. The owner may run it too; it needs no design background, only honesty.

1. Cover the money and the cards. Is there one thing on screen your eye goes to? If two or none, fix the color.
2. Is anything centered that does not have to be? Move it.
3. Count saturated colors. More than one (plus money, plus the cards between rounds): fix.
4. Is there a gradient, a glow, a blur or a translucent panel? Remove it.
5. Is there an emoji, a stock icon or a system font? Replace it.
6. Read every word aloud. Does any sentence sound like an advertisement, or like encouragement? Cut it.
7. Does anything pulse, shimmer or loop that is not the character breathing or the target moving? Stop it.
8. Is there one odd, deliberate choice on this screen? If not, make one.
9. Would this screenshot be recognizable as *this* game with the logo removed? If it could be any game, it is not done.
10. Squint. Can you still tell the ball, the target and the button? If not, the outlines or contrast are too weak.

**Why the checklist works:** "AI slop" is not a style; it is the absence of decisions. Centered, gradient, glowing, everything-animated, adjective-heavy screens are what you get when every choice is the statistical average. Each item above forces one decision that an average cannot make. A screen can be simple and even plain and still pass, as long as someone decided.

## 13. What is decided here and what is still open

Decided by this document (the owner can overrule any of it): art technique, palette tokens, fonts, layout proportions, motion timings, voice rules, the checklist.

Still open and listed in `docs/open-decisions.md`: the exact sports and their order (which decides which world colors are built first), the maximum number of arms (which decides how many character drawings exist), and whether the store listing may show the arm reveal in video ads.

## 14. For the owner: the five decisions that matter most

1. **Flat cut-out instead of 3D or pixels.** It is the one style we can produce the same way every time, by hand or by agent, and it keeps four arms readable on a small screen.
2. **One loud color at a time.** This is what the three references have in common and it is the single biggest difference between a screen that looks designed and one that looks generated.
3. **A deadpan commentator and a character who never speaks.** The arms are the joke; the game must not laugh at its own joke. Loud "NEW ARM!!!" banners would make it a feature list.
4. **A motion budget.** Few, short, physical animations with distinct timing, instead of everything easing in and out forever. Celebration (confetti) is rationed to two moments so it still means something.
5. **One odd choice per screen.** A rule that forces a human decision into every layout. It is the cheapest insurance against the "could be any app" feeling you describe.

## 15. Where the art comes from

Everything on screen today is drawn by code: the character, limbs, hoop, balls and the upgrade icons are Skia paths and plain views built from the theme tokens. That is deliberate: it is the one way to get the same outline width and the same palette everywhere, and procedural limbs need a procedural body. It is also why the first version looks plain.

For the next layer of art (balls with a face, sport props, the icon, store screenshots), three sources, in this order:

1. **Draw it in code or as SVG by hand.** The lead writes SVG paths for simple objects (a ball with a two-tone split and a seam, a flag, a cone keeper). Cheap, consistent, no licence questions. Good enough for everything round or rectangular.
2. **CC0 asset packs for props.** Kenney (kenney.nl, CC0, no credit needed) has sports, shape and UI packs in a flat vector style close to ours; OpenGameArt filtered to CC0. Recolor to the palette, redraw the outline at 3 px. Never mix a pack's style with ours unedited.
3. **AI tools for concepts and one-off illustrations**, never for in-game sprites unedited. Recraft (vector output, keeps a style across a set, usable for icon families), Adobe Firefly (trained on licensed material, safest commercially), Ideogram or Midjourney for mood boards and store artwork. Rules: generate in our palette with "flat vector, thick dark outline, no gradient, no texture", always redraw or trace the result so the outline, colours and proportions match, and keep the prompt and the source file in `assets/src/`. Purely AI-generated images may not be protected by copyright in the US, which is one more reason the shipped asset is always an edited one. Nothing that resembles a real brand or athlete.

What the owner decides per asset: approve the drawn version in a PR screenshot, or ask for a pack or AI pass. The checklist in section 12 applies to every asset exactly as it applies to a screen.
