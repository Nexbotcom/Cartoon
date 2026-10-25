import { PRESETS } from "./presets";
import { PROP_LIST } from "./props";
import { CastMember, PropKind, PropMember } from "./types";
import type { SceneFile } from "./projects";

const who = (id: string, x: number): CastMember => {
  const def = PRESETS.find(p => p.id === id);
  if (!def) throw new Error("Missing preset " + id);
  return { def, x, depth: 0 };
};
const prop = (kind: PropKind, name: string, x: number, depth: number, scale = 1): PropMember => ({
  id: `film-${kind}-${name}`, kind, name, x, depth, scale,
  color: PROP_LIST.find(p => p.kind === kind)?.color ?? "#888888", flip: false,
});

export const FILM: SceneFile[] = [
  {
    name: "1. The late friend",
    note: "Street, daytime. Sam runs in late, Kai explains the plan, a car drives past.",
    theme: "day",
    cast: [who("preset-sam", 200), who("preset-kai", 860)],
    props: [prop("tree", "Tree", 90, 0.7), prop("streetlight", "Streetlight", 1050, 0.7), prop("car", "Car", 640, 0.5)],
    script: `Kai: look at the camera, say "Okay. Mina's birthday is today. Where is Sam?"
Kai: look left and check the time then shrug
Sam: enter from the left, run to Kai and say "I am here! I am here! Do not panic!"
Kai: look at Sam, angry, say "You are twenty minutes late. The whole plan depends on you!"
Sam: say "I know, I know. The bus was slow again." while shrugging
Kai: say "Fine. I will take Mina for a walk. You prepare the room." then point right
Sam: nod and say "Leave it to me. She will never see it coming!"
Car: enter from the left and drive out of the scene to the right
Camera: follow Sam
Sam: smile then run out of the scene to the right
& Kai: wave and say "Hurry!"
Camera: zoom out`,
  },
  {
    name: "2. The quiet birthday",
    note: "Living room. Mina thinks everyone forgot. Kai arrives and takes her out.",
    theme: "room",
    cast: [who("preset-mina", 640), who("preset-kai", 980)],
    props: [
      prop("plant", "Plant", 90, 0.5), prop("lamp", "Lamp", 180, 0.6), prop("sofa", "Sofa", 520, 0.35),
      prop("tv", "TV", 1000, 0.55), prop("door", "Door", 1170, 0.8),
    ],
    script: `Mina: look at the TV, sad, say "Another quiet birthday. Nobody even called."
Kai: enter from the right and walk to Mina
Mina: look at Kai, surprised, say "Kai? What are you doing here?"
Kai: smile, say "Happy birthday! Come on, let us go for a walk."
Mina: shake head and say "I do not feel like it."
Kai: say "Please? Just ten minutes. I promise it is worth it." then point right
Mina: look at Kai, say "Why are you acting so strange?"
Kai: shrug and say "Who, me? Never."
Mina: smile and say "Okay, okay. Let me get my jacket."
Mina: walk out of the scene to the right
& Kai: look at the camera, smile then wave`,
  },
  {
    name: "3. The surprise",
    note: "Same room. Sam and Kai set up and hide, Mina walks in. Has a 360° shot (3D mode).",
    theme: "room",
    cast: [who("preset-sam", 420), who("preset-kai", 860), who("preset-mina", 1100)],
    props: [
      prop("plant", "Plant", 100, 0.55), prop("sofa", "Sofa", 330, 0.45), prop("table", "Table", 700, 0.55),
      prop("lamp", "Lamp", 1050, 0.6), prop("door", "Door", 1170, 0.8),
    ],
    script: `Sam: enter from the left, run to the center and say "She is gone! Quick, quick, quick!"
Sam: type on a laptop for 5 seconds and say "Ordering the cake and balloons right now."
Kai: enter from the right, run to Sam and say "She is almost back! Hide!"
Sam: surprised, say "Already?!" then run out of the scene to the left
& Kai: run out of the scene to the left
Mina: enter from the right, walk to the center and say "Hello? Is anybody home?"
Mina: look left, say "It is so quiet in here..."
Sam: enter from the left, run and jump and say "Surprise!"
& Kai: enter from the right, run and jump and say "Happy birthday Mina!"
& Mina: wait 2 seconds then surprised and jump
Camera: wait 2 seconds then zoom in on Mina
Mina: smile and say "You remembered! You really remembered!"
Camera: wait 2 seconds then orbit around Mina for 5 seconds
Sam: smile and say "We would never forget."`,
  },
  {
    name: "4. Sunset",
    note: "Park bench at sunset. The happy ending, finishing with a slow 360° shot (3D mode).",
    theme: "sunset",
    cast: [who("preset-sam", 400), who("preset-kai", 880), who("preset-mina", 640)],
    props: [
      prop("tree", "Tree", 80, 0.7), prop("tree", "Tree 2", 250, 0.8, 0.9),
      prop("bench", "Bench", 640, 0.35), prop("streetlight", "Streetlight", 1100, 0.7),
    ],
    script: `Mina: enter from the left, walk to the center and say "This is the best birthday ever."
Sam: enter from the left, walk to Mina and smile
& Kai: enter from the right, walk to Mina and smile
Kai: look at Sam, say "Sam, next year please bring the cake on time."
Sam: shake head, smile and say "No promises!"
Mina: laugh and say "I love you both. Thank you for the surprise."
Camera: zoom out
Kai: nod and say "Happy birthday, Mina!"
Sam: wave and say "Happy birthday!"
Mina: smile and say "Best day ever."
Camera: wait 1 second then orbit around Mina for 6 seconds`,
  },
];
