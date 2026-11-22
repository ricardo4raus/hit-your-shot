# Hit Your Shot: Design Rules

Art direction, interface rules, motion rules and the writing voice for the game. Every screen, asset and line of text is checked against this file. It is written for two readers: the people and agents who build the game, and the owner, who is not a designer but can tell when something feels generated. Each section ends with **Why**, in plain words, so the owner can judge the decision and not only the result.

The one-sentence version: **a lit, saturated arcade world, thick outlines, chunky shaded shapes, satisfying feedback, deadpan jokes, and at least one deliberately odd choice on every screen.**

> **Art direction revised 2026-11-22 (owner).** The first look (flat fills, pastel haze, no gradients, no shadows, one saturated hue) read as amateur and boring next to the games on the charts. The owner asked to change everything in the visual review: sections 1, 3, 4, 9, 11, 12 and 14 below are rewritten for the new "polished arcade" look. The deadpan voice, the outline, the fonts and the rules about the limbs stay.

---

## 1. What this game looks like, in one paragraph

A cheerful, slightly stupid sports game that looks like it belongs on the top charts. Chunky, shaded shapes with thick dark outlines, lit by one warm key light from the upper left. Saturated, high-contrast color: a deep blue arena, a warm wooden court, an orange ball and hoop that pop against them. Every object has volume (a base tone, a shadow, a highlight). The world is full: crowd in the stands, lights in the roof, lines on the floor. Hits feel good: particles, a flash, a short word, a sound. Big rounded letters with an outline for anything the player must read in one glance. Nothing is glass, nothing is neon, nothing floats on a purple-blue gradient.

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

## 3. The art technique: shaded cut-out with thick outlines

- Shapes have a dark `ink` outline of constant width (3 px at 1x on phones) on characters, balls, props and interface. Far background detail (crowd, lights, banners) may use thinner outlines or none, so the near objects stay loudest.
- **Every shape is lit.** One warm key light from the upper left. Each object has at least two tones and usually three: base, shadow toward the lower right, highlight toward the upper left. Round things (balls, heads, coins) get a specular highlight. Linear and radial gradients are allowed inside shapes, in the world and on interface surfaces.
- **Soft shadows are allowed.** Objects on the floor cast a soft (blurred or gradient) contact shadow. Buttons and cards have a darker bottom lip that makes them look pressable (this replaces the owner's 2026-11-15 removal of the drop shadow: a lip is part of the button, not a shadow under it).
- **Glow is allowed sparingly**: arena lights, the hit flash, a ball on a streak. Never around interface panels or text.
- **Backgrounds are full, not empty.** Basketball: stands with a crowd, railing, banners, roof lights, a wooden floor with planks, painted key, arcs and lines, a soft vignette at the edges. Farther things are darker, bluer and less contrasted (depth), but never empty pastel haze.
- Characters, balls, targets and props are vector shapes drawn by code (Skia paths) or SVG. No pixel art, no photos, no 3D renders.
- Rounded corners on interface elements are large (20 px cards, 16 px buttons, full pill for tags). Corners on world objects follow the object.

**Why:** the first version followed "flat, no gradient, no shadow, empty background" to stay consistent and avoid the generated look. It was consistent, but it read as a wireframe: the games players compare us to are lit, saturated and busy where it matters. Code can still draw this look the same way every time, as long as the light direction, the tone steps and the outline are fixed rules.

## 4. Color

Tokens live in `src/ui/theme.ts`; world colors per sport live with the layer that draws them (`src/features/play/layers/`). Names describe the job, not the color.

| Token | Job |
|---|---|
| `ink` `#1F2430` | every outline, text on light fills |
| `paper` `#FFF7E8` | light surfaces, highlights on paper things |
| `accent` `#FF8A3D` | the main action button, the aim guide |
| `good` green | money (the coin), a hit, a maxed bar |
| `cash` yellow | "NEW BEST!" and display lettering fill |
| `bad` red | a destructive confirmation |
| `arm` `#B07CF0` | reserved: anything about characters and arms, so the reveal has its own color |

Rules:

- **Saturated and contrasted.** Backgrounds are deep and saturated enough that the ball, the target and the button pop by value contrast, not by being the only color. Basketball: deep blue arena, warm wood court, orange ball and rim.
- Each shape uses its base color plus a darker shade and a lighter highlight of the same hue (shift the shade slightly toward blue, the highlight slightly toward yellow).
- Text on saturated fills is `ink`, or white with an `ink` outline; never thin colored text on a colored fill.
- The three upgrade cards keep three fill colors (blue, orange, green).
- No pure black, no pure white for large areas.
- **Still banned:** the generic purple-blue gradient, neon on black, glass (translucent white with blur).

**Why:** a calm pastel world made the whole screen look washed out; value contrast is what makes the hero objects pop. The banned list is still the signature of interfaces made without a decision.

## 5. Typography

- **Display:** Lilita One (SIL Open Font License, free). Used for: sport names, "NEW!", the round result number, the price on a button. Always with an `ink` outline (text stroke 2 px, or a duplicated layer offset by 1 px in four directions), always short, never a sentence.
- **Interface:** Nunito (Open Font License). Weights: 700 for labels and numbers, 600 for body. No other weights.
- Numbers that change every frame (money during a round) sit left-aligned in a fixed-width box, so the text does not jump when digits change. Nunito has tabular figures; use them.
- **Money is never display lettering** (owner 2026-11-19: "the 3D money font is not good; a green money icon and the numbers like a normal mobile game"). Everywhere money appears it is the green coin (`src/ui/money.tsx`: `good` disc, ink outline, dollar sign) followed by plain bold Nunito digits: the pill, prices on buttons, the round's result, the shop. Display lettering is for sport names and "NEW!" only.
- ALL CAPS only in the display font, and only for one or two words. Labels and body are sentence case.
- Minimum sizes: 14 pt body, 16 pt labels on buttons, 28 pt display. Nothing on screen is smaller than 12 pt, ever, including the pips' tiny numbers, which do not exist.
- No Inter, Roboto, Poppins, Montserrat, SF Pro or system default anywhere. If a font is not installed, the screen is not finished.

**Why:** the display font carries the personality: round, heavy, a bit goofy. The interface font stays out of the way. Two fonts, two weights each, is enough and keeps every screen consistent. The banned list is simply the set of fonts that every generated interface defaults to, which is why they feel generated.

## 6. Layout

- Portrait only. Design at 375 × 812 pt and check at 360 × 740 (small Android) and 430 × 932 (large iPhone).
- Grid: 16 pt gutter, 8 pt base unit, 12 pt between cards. Touch targets at least 48 × 48 pt.
- The play field fills the **whole screen**, seen **from behind the character** (owner decision 2026-11-16, like the first reference). The camera stands behind the character's right shoulder and looks at the target: the target sits on the screen's center line, the character stands **left of center** with its back to the player and takes a little under half the height, its legs run under the cards. From dead behind, the shooting hand hid behind the head and the ball's arc was a vertical line; the shoulder view (first screenshots, 2026-11-16) shows both. The camera never moves. Numbers in `src/features/play/camera.ts`.
- Money sits top center in a chunky navy pill with the shaded green coin and plain digits. Settings is a round 3D button top right. Nothing else is in the top bar during a round.
- The upgrade cards sit over the bottom 30%: three cards, equal width, each with name, icon, pips, and one button that shows the price. **The cards exist only between rounds** (owner decision 2026-11-16): they slide away when a round starts and come back when it ends. Buying happens only between rounds (owner decision 2026-11-15); the buttons stay disabled during a round as a second guard. The cards stand on a navy tray with a lit top edge; each has a "Lv" chip, a segmented level bar and a 3D price button that is grey when unaffordable and green when it can be pressed (2026-11-22). Shop is a tab on the tray edge.
- Between rounds **one play button** stands centered above the cards. After a round the money it made stands right of the character as the coin and digits in a pill, a crooked "NEW BEST!" above it on a best round, the commentator's line in a small caption under it. The play button sits half sunk into the tray's top edge (2026-11-22). **No panel, no card** (owner decision 2026-11-16): the character stopping is the signal that the round is over.
- If a screen feels empty, that is the world's job to fix (crowd, lights, floor detail), not the interface's job to fix with widgets. No interface element covers the character: the result money, the "NEW BEST!" tag and the commentator's caption sit in the empty court to its right (2026-11-22).
- Every screen has **one odd choice**: something off-grid, oversized or tilted that a template would not do. On the play screen it is the character cut by the bottom edge, a back in the foreground against a small basket, and the "NEW!" tag hanging crooked beside the round's money. One per screen, never three.

**Why:** generated layouts center everything and fill every gap, because that is the average of all layouts. This screen does center its button, because the owner wants the thumb to find it without looking, and the camera behind the character makes the center the natural line of play. So the deliberate choice moved from position to scale. The "one odd choice" rule forces a decision on every screen; a decision is exactly what slop lacks.

## 7. Icons

- Icons are drawn for this game in the same cut-out style: flat fill, `ink` outline, one or two colors, 2 px detail minimum. Each upgrade icon is a small scene, not a symbol: accuracy is the ball going through the hoop with motion lines; fire rate is three balls in a row leaving a hand; income is a coin with a face.
- No emoji. No icon fonts. No generic line icons in a circle (Lucide, Feather, Material) in the game itself. In settings and legal screens, plain text labels beat generic icons.
- An icon and its label are never redundant: if the label says "Accuracy", the icon shows what accuracy *does*, not a crosshair.

**Why:** emoji and stock icons are the fastest way to make a screen look assembled rather than designed, and every player has seen them a thousand times. A drawn icon with a tiny joke in it is remembered.

## 8. The character

- One body shape, round head, dot eyes, a mouth that changes. Four expressions are enough: neutral, strain (heavy ball), surprise (wide eyes, small mouth), smug (half-closed eyes, small smile).
- The player sees the character **from behind** (2026-11-16): the back of the head is tufted hair with a headband and two ears; the basketball kit (2026-11-22) is a red-pink tank top with cream trim, the number 7 and the invented name "SWISH" on the back, long shorts with side stripes, striped socks and chunky sneakers. Every part is shaded from the upper-left light (colors in `src/features/play/character/palette.ts`). The face shows when the character looks over its shoulder at the camera: after a perfect round (smug), when a ball bounces back and hits it (surprise), and when a new character walks in. Limbs on the back are nearest to the camera and are drawn over the torso; the others reach around it.
- The character dresses like a player now (2026-11-22: the plain shirt read as programmer art). The joke stays in the deadpan and the limbs, not in the clothes; later characters may still carry one slightly wrong item (a tie in the gym), never a costume.
- Idle: breathes (2% scale on the torso, 2.4 s loop). Nothing else loops.
- Shooting (owner 2026-11-16: "bend the knees, stretch the arm, flick the hand"; built as a rig in `src/features/play/rig.ts`): the body is a skeleton with hips, shoulders, two legs with knees and any number of arms with elbows and wrists, posed by two-bone inverse kinematics every frame. One shot, in seconds around the moment the ball leaves: dip (−0.40 to −0.12 s: knees bend, the ball comes down to the chest), rise (to 0: knees extend, the arm straightens up to the release point, wrist cocked back), flick (0 to 0.08 s: the wrist snaps forward), follow-through (to 0.30 s), return to the hold (to 0.55 s). The hold is the ball at the chin with the elbows out. When shots come faster than the cycle, the cycle is squeezed into the gap, so a fast arm pumps instead of freezing. The knees follow the deepest dip of any arm; the torso leans into it. Heavy balls will stretch the dip and add the strain face (not built yet).
- **Every added arm knows how to move**: it hangs from its anchor (section 8 below), bends its elbow down and out, holds its own ball, and runs the same cycle on its own fire schedule. Arms on the back are nearest the camera and are drawn over the torso; the others reach around it.
- Reacting: a miss that bounces back and hits the character gets the surprise face and a 3-frame shake. A perfect round gets smug. Reactions last under 600 ms and never block input.

Extra limbs (see `docs/game-design.md`; the limbs are a surprise). Each sport uses the body part the sport uses: arms in basketball and golf, **feet in football**. Every sport starts with one of that limb. Characters are per sport.

- **Limbs are procedural and uncapped.** The character is drawn by code, and limb *n* is placed by an algorithm, never by hand. The algorithm follows the body first and then stops being sensible: arms 1 and 2 at the shoulders, 3 from the middle of the back, 4 from the hip, then alternating sides down the torso and up the back, with a small deterministic variation in height, length and rest angle (from the limb index, not from randomness) so a crowd of limbs looks grown rather than stacked. Feet: 1 and 2 at the hips, 3 from the side of the torso, 4 from the back, then the same pattern; the character stands on whichever feet are not kicking. Outlines stay the same width at every count, limbs behind the body are drawn first and slightly darker, and nothing ever overlaps the face. The character never comments. The shop card never says "arms" or "feet". The card says the character's name and shows a silhouette with the limb count hidden behind the body.
- **Extreme volume looks like fun, not like a bug.** When hundreds of balls are in flight, they are drawn in one batch, keep their outline, bounce off rim, board, floor and walls, and fade quickly after landing. Hit feedback is throttled so a flood stays readable. No slow-motion, no warning. The commentator may notice ("That is a lot of ball.").
- The first time a new character walks in, the extra limb is **folded** (an arm against the body, a foot tucked behind the standing leg) and unfolds on the first shot. No fanfare text, no confetti. The commentator line (section 10) is the only acknowledgement.
- From limb 5 on, each new limb does something other than shoot once before shooting: an arm holds a drink, waves, scratches the head; a foot taps, stretches, or kicks the standing leg. Then it joins the line. This is the only place in the game where a gag is scripted rather than emergent.
- Football with one foot: the character hops. The hop is the walk cycle. It is slow, slightly undignified, and not fixed when more feet arrive; extra feet kick, they do not help walking.

**Why:** the arms are funny only if the game pretends they are normal. A banner saying "NEW ARM UNLOCKED!!!" turns a joke into a feature list. Deadpan is a design rule here, not a tone preference.

## 9. Motion

Everything the player does gets a reaction within 100 ms. Everything the game does to the player is readable in under 400 ms.

| Moment | What happens | Timing |
|---|---|---|
| Press a button | scales to 0.96 | 90 ms down, 160 ms up, spring with slight overshoot |
| Drag the aim line | the perfect arc follows the finger with no smoothing; the two spread arcs follow | immediate |
| Ball leaves the hand | ball stretches 1.15 along the direction of travel for 2 frames | 40 ms |
| Hit | the net swishes (350 ms), a bright flash at the rim, a burst of sparks that falls and fades, a short popup word in the display font ("SWISH!", streak words), the money pill pops 1.12, the swish sound. **No coin rising from the hoop** (owner 2026-11-22: it looked odd) | under 700 ms |
| Hit streak | at streak thresholds a bigger word, the balls get a fire trail, a light screen shake, a crowd cheer | under 600 ms |
| Miss | ball bounces with correct physics and the sound of the surface, then fades and shrinks away after landing so missed balls never clutter the court | physics, fade about 400 ms |
| Round starts | the cards slide down out of the way; the play button fades | 280 ms, ease-out |
| Round ends | the character stops; the cards slide back; the money, the line and the play button rise 24 pt and fade in above them | 280 ms, ease-out, no bounce |
| Upgrade bought | the pip fills, the card icon pops 1.1, the button price updates with a count | 240 ms |
| New ball unlocked | the ball rolls in from the right and stops in front of the character | 600 ms |
| New character | walks in from the left (120 ms per step, 4 steps), stops, looks at the camera for 400 ms | about 900 ms |

Rules:

- Use springs (with a little overshoot) for things that respond to the player, and ease-out for things the game shows the player. Never ease-in-out for everything.
- Loops are allowed where they make the world feel alive and cost nothing to read: the character breathing, the target moving, the aim guide's dots flowing toward the target, the first-round hand hint. No pulsing buttons.
- Particles belong to events (hits, streaks, purchases), never idle in the background.
- Big confetti stays rationed to two moments: the first 2-arm character, and finishing a sport.
- Reduce Motion (phone setting) turns off scale, slide and screen shake and thins the particles; fades remain.
- Haptics: light tap on button press, a soft "tick" per hit, one medium on a new best round, one heavy when a character walks in. Never per shot; shots are too frequent.

**Why:** generated games animate everything the same way (ease-in-out, 300 ms, forever pulsing), which turns motion into noise. A few distinct, short, physical reactions make the game feel like it has weight. The confetti budget is a budget on purpose: a celebration you see every minute is not a celebration.

## 10. Writing voice

The game talks in two places: a sports commentator who comments on the round result, and the shop and interface labels. Nobody else speaks. The character has no lines.

The commentator:

- Deadpan, dry, professional, slightly tired. Treats everything, including the arms, as a normal sporting event.
- Lines are **at most eight words**. Most are under five.
- One line per round result, chosen from a pool by situation (perfect round, zero hits, new best, heavy ball barely moved, first time with 2 arms). A line is never shown twice in a row and no line appears more than once per session.
- Specific over general. "Three off the rim." beats "Nice try!". A number, an object or a body part makes a line specific.
- Never exclaims. The commentator has no exclamation marks. The arena has a few: the short popup words on hits and streaks ("SWISH!", "ON FIRE!") and the "NEW BEST!" tag (owner 2026-11-22). They are the scoreboard, not the commentator.
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

Banned words and patterns anywhere in the game, store listing or marketing: epic, awesome, legendary, ultimate, insane, unleash, journey, experience, adventure awaits, "whether you're a ... or a ...", three adjectives in a row, a rhetorical question followed by an answer, an exclamation mark after a sentence (the popup words and "NEW BEST!" are not sentences).

**Why:** humor written by generators is loud, punny and approving: it tells you it is funny. Human humor in a game like this is quiet and lets the picture do the work: a man with three arms, a commentator who refuses to notice. Short lines also fit the screen and the four-second attention budget of a round result. The banned list is the vocabulary of app store copy that nobody believes.

## 11. Sound

- Every shot has a soft release sound; every hit has a satisfying swish; misses make the physical sound of what they hit (rim clank, floor bounce). Hit streaks get a crowd cheer.
- Round end: one short jingle, the same every time. New best: a fanfare with a cheer.
- A new character: footsteps, then nothing. The silence is the joke.
- No background music in version 1.
- Sounds are synthesized by `tools/make-sfx.ts` into `assets/sfx/` (license-clean, reproducible). They can be replaced by CC0 or recorded sounds later; no stock "success chime".
- Repeated sounds are rate-limited and slightly varied, so hundreds of shots per second never turn into noise.

**Why:** sound is half of what makes a hit feel good. A silent game feels broken even to players who usually play muted.

## 12. The "feels generated" checklist

Run before any screenshot goes into a PR (`npm run screenshot` makes them from the web build; `docs/dev-notes.md`). The owner may run it too; it needs no design background, only honesty.

1. Cover the money and the cards. Is there one thing on screen your eye goes to? If two or none, fix the contrast.
2. Is anything centered that does not have to be? Move it.
3. Is every object lit from the upper left, with a shadow tone and a highlight? A flat single-color shape is not finished.
4. Is there empty, unlit background with nothing in it? Fill it with the world (crowd, lights, floor detail), not with widgets.
5. Is there an emoji, a stock icon, a system font, glass or a purple-blue gradient? Replace it.
6. Read every word aloud. Does any sentence sound like an advertisement, or like encouragement? Cut it. (Short popup words on hits are the arena, not the commentator.)
7. Does a hit feel good with the sound on and with it off? Flash, particles, word, pill pop, swish.
8. Does any interface element cover the character? Move it.
9. Is there one odd, deliberate choice on this screen? If not, make one.
10. Would this screenshot hold up next to a top-chart game in the store? If it looks like a prototype, it is not done.
11. Squint. Can you still tell the ball, the target and the button? If not, the outlines or contrast are too weak.

**Why the checklist works:** "AI slop" is not a style; it is the absence of decisions. Centered, gradient, glowing, everything-animated, adjective-heavy screens are what you get when every choice is the statistical average. Each item above forces one decision that an average cannot make. A screen can be simple and even plain and still pass, as long as someone decided.

## 13. What is decided here and what is still open

Decided by this document (the owner can overrule any of it): art technique, palette tokens, fonts, layout proportions, motion timings, voice rules, the checklist. On 2026-11-22 the owner replaced the flat pastel look with the "polished arcade" look (sections 1, 3, 4, 9, 11, 12, 14).

Everything that was open here was decided on 2026-11-15 (`docs/decisions.md`): sports and order, procedural uncapped limbs, Trophies. On 2026-11-16 the owner changed the view to third person and removed the result panel; sections 6, 8 and 9 were rewritten for that.

## 14. For the owner: the five decisions that matter most

1. **Shaded cut-out instead of 3D or pixels** (revised 2026-11-22). Outlined vector shapes with one light direction and three tone steps: produced the same way every time by code, readable with four arms, and no longer flat.
2. **Saturated, lit, full world** (revised 2026-11-22). The pastel "one loud color" rule made the game look washed out; value contrast now does that job.
3. **A deadpan commentator and a character who never speaks.** The arms are the joke; the game must not laugh at its own joke. Loud "NEW ARM!!!" banners would make it a feature list.
4. **A motion budget.** Few, short, physical animations with distinct timing, instead of everything easing in and out forever. Celebration (confetti) is rationed to two moments so it still means something.
5. **One odd choice per screen.** A rule that forces a human decision into every layout. It is the cheapest insurance against the "could be any app" feeling you describe.

## 15. Where the art comes from

Everything on screen today is drawn by code: the character, limbs, court, hoop, balls and the upgrade icons are Skia paths and views built from the theme tokens, shaded by the rules in section 3 (2026-11-22). Procedural limbs need a procedural body, so the character stays in code; an artist would replace the shapes, not the rig.

For the next layer of art (balls with a face, sport props, the icon, store screenshots), three sources, in this order:

1. **Draw it in code or as SVG by hand.** The lead writes SVG paths for simple objects (a ball with a two-tone split and a seam, a flag, a cone keeper). Cheap, consistent, no licence questions. Good enough for everything round or rectangular.
2. **CC0 asset packs for props.** Kenney (kenney.nl, CC0, no credit needed) has sports, shape and UI packs in a flat vector style close to ours; OpenGameArt filtered to CC0. Recolor to the palette, redraw the outline at 3 px. Never mix a pack's style with ours unedited.
3. **AI tools for concepts and one-off illustrations**, never for in-game sprites unedited. The owner asked about Higgsfield (2026-11-16): it is a video and photoreal-image platform for social creators (Soul, DOP, access to Sora, Kling, Veo), not a vector tool. Right place for it: the store preview video and ads later, not in-game art. For the art itself the order below stands. Recraft (vector output, keeps a style across a set, usable for icon families), Adobe Firefly (trained on licensed material, safest commercially), Ideogram or Midjourney for mood boards and store artwork. Rules: generate in our palette with "cel-shaded vector, thick dark outline, warm key light from the upper left", always redraw or trace the result so the outline, colours and proportions match, and keep the prompt and the source file in `assets/src/`. Purely AI-generated images may not be protected by copyright in the US, which is one more reason the shipped asset is always an edited one. Nothing that resembles a real brand or athlete.

What the owner decides per asset: approve the drawn version in a PR screenshot, or ask for a pack or AI pass. The checklist in section 12 applies to every asset exactly as it applies to a screen.
