import { PRESETS } from "./presets";
import { DEFAULT_Y, PROP_LIST } from "./props";
import { CastMember, PropKind, PropMember } from "./types";
import type { SceneFile } from "./projects";

// positions are in metres: X left(-) / right(+), Z toward the camera (+) / away (-)
const px = (X: number) => Math.round(640 + X * 150);
const who = (name: string, X: number, Z = 0): CastMember => {
  const def = PRESETS.find(p => p.name === name);
  if (!def) throw new Error("Missing character " + name);
  return { def, x: px(X), depth: -Z / 8 };
};
const P = (kind: PropKind, name: string, X: number, Z: number, o: { rot?: number; y?: number; color?: string; scale?: number } = {}): PropMember => ({
  id: `s-${kind}-${name}`, kind, name, x: px(X), depth: -Z / 8, scale: o.scale ?? 1,
  color: o.color ?? (PROP_LIST.find(p => p.kind === kind)?.color ?? "#888888"), flip: false,
  y: o.y ?? DEFAULT_Y[kind] ?? 0, rot: o.rot ?? 0,
});

// ----- the classroom of 7B: 7 desks, 7 chairs (Chair 1 to Chair 7), students face the camera -----
const classroom = (): PropMember[] => {
  const a = [-3.9, -1.3, 1.3, 3.9], b = [-2.6, 0, 2.6];
  return [
    P("board", "Board", 0, -9.75), P("desk", "Teacher Desk", -4.6, -6.2), P("clock", "Clock", 4.6, -9.95, { y: 3.4 }),
    P("plant", "Plant", 5.4, -8.2), P("fan", "Fan", 0, -3.5, { y: 4.6 }), P("bin", "Bin", -5.6, -4.5),
    ...a.flatMap((X, i) => [P("desk", `Desk ${i + 1}`, X, -1.3), P("chair", `Chair ${i + 1}`, X, -2.25)]),
    ...b.flatMap((X, i) => [P("desk", `Desk ${i + 5}`, X, -3.7), P("chair", `Chair ${i + 5}`, X, -4.65)]),
  ];
};
// where chair i sits, so a character can start the episode already at its seat
const chairX = [-3.9, -1.3, 1.3, 3.9, -2.6, 0, 2.6];
const chairZ = [-2.25, -2.25, -2.25, -2.25, -4.65, -4.65, -4.65];

export const SERIES: SceneFile[] = [
  {
    name: "S1E1 · The Seating Plan",
    note: "Classroom. Alex gives every student a numbered chair. Shows chair assignment. About 1 min.",
    theme: "classroom",
    cast: [who("Alex", -4.0), who("Ada", -2.6), who("Ben", -1.7), who("Tito", -0.8), who("Zoe", 0.1), who("Kai", 1.0), who("Mina", 1.9), who("Jade", 2.8)],
    props: classroom(),
    script: `Alex: look at the camera, smile, say "Welcome to Class 7B. Today we have a new seating plan."
Alex: point right and say "Ada, you sit in the front, Chair 1."
Ada: sit on Chair 1 and say "Yes, teacher!"
Alex: say "Ben, Chair 2. Tito, Chair 3."
Ben: sit on Chair 2 and smile
& Tito: sit on Chair 3 and wave
Alex: say "Zoe, Chair 4. Kai, Chair 5. Mina and Jade, Chairs 6 and 7."
Zoe: sit on Chair 4
& Kai: sit on Chair 5
& Mina: sit on Chair 6
& Jade: sit on Chair 7
Alex: look at the class, surprised, say "Wait. Where is Tito?"
Tito: look at Ada, say "I am right here, teacher. I am just very small!"
Ada: laugh and say "He is hiding behind his desk!"
Alex: shake head, smile and say "Class 7B, you are going to be the death of me."
Camera: zoom on Alex 50 percent`,
  },
  {
    name: "S1E2 · The Missing Homework",
    note: "Classroom. Everyone starts seated. Excuses, a chorus of Awww. About 1 min.",
    theme: "classroom",
    cast: [
      who("Alex", -4.6), who("Ada", chairX[0], chairZ[0]), who("Ben", chairX[1], chairZ[1]), who("Tito", chairX[2], chairZ[2]),
      who("Zoe", chairX[3], chairZ[3]), who("Kai", chairX[4], chairZ[4]), who("Mina", chairX[5], chairZ[5]), who("Jade", chairX[6], chairZ[6]),
    ],
    props: classroom(),
    script: `Ada: sit on Chair 1
& Ben: sit on Chair 2
& Tito: sit on Chair 3
& Zoe: sit on Chair 4
& Kai: sit on Chair 5
& Mina: sit on Chair 6
& Jade: sit on Chair 7
Alex: walk to Ada, look at the class and say "Good morning, 7B. Please pass your homework forward."
Ada: say "Here it is, teacher."
Ben: look at Tito and say "Tito, did you do the homework?"
Tito: look at Ben, say "I did. My dog ate it."
Alex: surprised, say "Your dog ate it? Again?"
Tito: nod and say "He was very hungry."
Alex: look at Kai, say "Kai, where is yours?"
Kai: stand up and say "I left it on the bus, teacher."
Alex: angry, say "The bus? Class 7B, the bus does not have a locker!"
Mina: laugh and say "The bus took his homework to school faster than he did!"
Jade: say "Maybe the bus is smarter than all of us."
Alex: shake head and say "Everyone, one extra page tonight."
Ben: sad, say "Awww!"
& Tito: sad, say "Awww!"
& Kai: sad, say "Awww!"
Camera: zoom on Alex 60 percent`,
  },
  {
    name: "S1E3 · Football Trial",
    note: "Pitch with the stadium crowd. Goal, ball and a bench for two spectators. About 1 min.",
    theme: "pitch",
    cast: [who("Coach", -3.6), who("Kai", -2.2), who("Tito", 0.4), who("Jade", 2.6, -0.8), who("Ben", 3.6, -0.8)],
    props: [P("goal", "Goal", 0, -5.6), P("ball", "Ball", -1.0, -0.8), P("bench", "Bench", 3.2, -1.6), P("bin", "Bin", 5.2, -2.4)],
    script: `Jade: sit on Bench
& Ben: sit on Bench
Coach: look at the camera and say "Welcome to the Class 7B football trial!"
Coach: point right and say "Kai, you are our goalkeeper. Stand in the Goal."
Kai: walk to the Goal and say "Nobody scores against me!"
Tito: look at Kai and say "Watch me, big guy."
Tito: pick up the Ball then walk to the Goal then put down the Ball
Kai: look at Tito, surprised, say "Hey, that is not how football works!"
Tito: jump and say "Goal! One zero!"
Coach: laugh and say "I did not teach you that, Tito."
Camera: wait 1 second then zoom on Kai 60 percent
Kai: sad, say "My perfect record."
Coach: nod and say "Fine. Welcome to the team, Tito."
Tito: wave and say "Thank you, coach!"`,
  },
  {
    name: "S1E4 · Nurse Amy",
    note: "Hospital ward. Ben fakes a stomach ache on a bed. Lie down, stand up, enter through the Door. About 1 min.",
    theme: "ward",
    cast: [who("Ben", -1.0), who("Amy", 0.8)],
    props: [
      P("bed", "Bed 1", -3.0, -3.0, { color: "#dbe9f4" }), P("bed", "Bed 2", -3.0, -5.6, { color: "#dbe9f4" }),
      P("ivstand", "IV stand", -1.7, -2.0), P("chair", "Chair", 0.2, -3.2, { rot: -90 }),
      P("locker", "Locker 1", 2.2, -8.6), P("locker", "Locker 2", 3.3, -8.6), P("door", "Door", 4.3, -8.95),
      P("clock", "Clock", 0, -8.95, { y: 3 }), P("curtains", "Curtains", -3.0, -8.9, { y: 1.1 }), P("plant", "Plant", 5.0, -3.5),
    ],
    script: `Ben: sad, say "Ooooh, my tummy hurts so much."
Amy: walk to Ben and say "Come with me, Ben. Lie down on Bed 1."
Ben: lie on Bed 1 and say "It hurts, nurse Amy."
Amy: look at Ben, say "Hmm. How many sweets did you eat today?"
Ben: say "Just ten. Maybe twenty."
Doc: enter through the Door and walk to Amy
Doc: look at Ben and say "I heard there is a patient with a very serious stomach ache."
Amy: say "Doctor, he ate twenty sweets."
Doc: nod and say "The treatment is simple. No sweets for one week."
Ben: surprised, stand up and say "One whole week?!"
Mina: enter from the left and run to Ben
Mina: say "Ben! Are you okay? I brought you sweets!"
Doc: shake head, say "Absolutely not."
Camera: zoom on Ben 50 percent`,
  },
  {
    name: "S1E5 · Sleepover at Mina's",
    note: "Big house lounge: two sofas facing each other (Sofa and Sofa 2), a coffee table and a cake. About 1 min.",
    theme: "house",
    cast: [who("Mina", -0.6), who("Jade", -2.2), who("Zoe", 0.9), who("Kai", 2.2), who("Grandpa", 3.8)],
    props: [
      P("rug", "Rug", 0, -4.2, { scale: 1.6, color: "#a55d4a" }), P("sofa", "Sofa", -3.5, -4.2, { rot: 90 }),
      P("sofa", "Sofa 2", 3.5, -4.2, { rot: -90 }), P("table", "Table", 0, -4.2),
      P("table", "Table 2", -1.6, -1.3, { scale: 0.7 }), P("cake", "Cake", -1.6, -1.3, { y: 0.45 }),
      P("tv", "TV", 0, -9.6), P("lamp", "Lamp", -5.0, -7.0), P("plant", "Plant", 5.2, -8.5),
      P("picture", "Picture", -3, -12.95, { y: 1.9 }), P("picture", "Picture 2", 3, -12.95, { y: 1.9 }),
    ],
    script: `Mina: look at the camera, smile, say "Tonight is the sleepover! Everyone, sit down."
Jade: sit on Sofa and say "I call this sofa!"
Zoe: sit on Sofa 2 and say "Then I take this one."
Kai: sit on Sofa 2 and say "Hey, make some space!"
Mina: pick up the Cake then walk to the Table then put the Cake on the Table
Mina: say "A surprise cake for the best friends ever!"
Jade: surprised, say "Wow, Mina! Is that chocolate?"
Grandpa: enter from the right and walk to Mina
Grandpa: look at the Cake, say "I smell cake. Is there any left for an old man?"
Mina: laugh and say "Grandpa, you can have the biggest slice."
Grandpa: sit on Sofa and smile
Jade: look at Grandpa, say "Grandpa, you are sitting on my phone!"
Grandpa: surprised, stand up and say "Oh dear!"
Zoe: laugh and say "This is the best sleepover ever."
Camera: wait 1 second then orbit around the Table for 5 seconds`,
  },
  {
    name: "S1E6 · The Late Bus",
    note: "Street. Two kids wait on a bench, Grandpa arrives in a car and drives them off. About 1 min.",
    theme: "day",
    cast: [who("Ben", 1.9, -1.0), who("Tito", 2.8, -1.0), who("Grandpa", -2.4, -2.0)],
    props: [
      P("bench", "Bench", 2.4, -1.6), P("streetlight", "Streetlight", 4.6, -2.0), P("bush", "Bush", -4.2, -4.6),
      P("car", "Car", -3.4, -4.0, { color: "#e0a030" }), P("bin", "Bin", 0.4, -1.6),
    ],
    script: `Ben: sit on Bench and say "The bus is late again."
Tito: sit on Bench and say "It is always late. I think it is lost."
Grandpa: get in the Car
Car: wait 3 seconds then drive to Ben
Grandpa: say "Need a ride to school, kids?"
Ben: surprised, stand up and say "Grandpa! Yes, please!"
Tito: stand up and say "Finally!"
Ben: get in the Car
& Tito: get in the Car
Grandpa: say "Hold on tight. I drive very fast."
Car: wait 1 second then drive off to the right
Camera: follow Car`,
  },
  {
    name: "S1E7 · The Penalty",
    note: "Full stadium (3D recommended). Goals at both ends, Kai takes a penalty and kicks the ball into the goal. About 1 min.",
    theme: "pitch",
    cast: [who("Kai", 21.8, -3), who("Coach", 20.2, -1), who("Tito", 18.6, -4), who("Jade", 19.4, 0), who("Ben", 17.6, -1.5)],
    props: [
      P("goal", "Goal", 29.2, -3, { rot: -90 }), P("goal", "Goal 2", -29.2, -3, { rot: 90 }), P("ball", "Ball", 23.5, -3),
      P("bench", "Bench", 14, -19.8), P("bin", "Bin", 24, -19.6),
    ],
    script: `Camera: follow Kai for 0.1 seconds
Coach: look at the camera and say "Final of the Class 7B cup. Kai takes the penalty!"
Tito: look at Kai and say "No pressure, big guy."
Kai: nod and say "I have trained for this all week."
Jade: say "Kick it hard, Kai!"
Kai: kick the Ball to the Goal
Camera: follow Ball
Ben: jump and say "Goal! Goal! Goal!"
Camera: wait 2 seconds then follow Kai
Kai: wave and say "Thank you, 7B!"`,
  },
];
