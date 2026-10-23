import React from "react";

export type RigPose = {
head: number;
body: number;
leftArm: number;
rightArm: number;
leftLeg: number;
rightLeg: number;
};

export const defaultRigPose: RigPose = {
head: 0,
body: 0,
leftArm: 0,
rightArm: 0,
leftLeg: 0,
rightLeg: 0,
};

type CharacterAppearance = {
skin: string;
hair: string;
shirt: string;
pants: string;
shoes: string;
hairstyle?: string;
};

type RiggedCharacterProps = {
appearance: CharacterAppearance;
pose: RigPose;
onPoseChange?: (pose: RigPose) => void;
editable?: boolean;
};

export default function RiggedCharacter({
appearance,
pose,
}: RiggedCharacterProps) {
const {
skin,
hair,
shirt,
pants,
shoes,
hairstyle = "Short",
} = appearance;

return (
<svg
className="character-art rigged-character"
viewBox="0 0 240 360"
width="240"
height="360"
xmlns="http://www.w3.org/2000/svg"
role="img"
aria-label="Rigged cartoon character"
>
{/* Legs: rotate around the hips */}
<g transform={"rotate(${pose.leftLeg} 99 224)"}>
<path
d="M99 220 L94 278 L91 310"
fill="none"
stroke={pants}
strokeWidth="24"
strokeLinecap="round"
strokeLinejoin="round"
/>
<path
d="M91 310 L111 310"
stroke={shoes}
strokeWidth="13"
strokeLinecap="round"
/>
</g>

  <g transform={`rotate(${pose.rightLeg} 141 224)`}>
    <path
      d="M141 220 L147 278 L151 310"
      fill="none"
      stroke={pants}
      strokeWidth="24"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M151 310 L171 310"
      stroke={shoes}
      strokeWidth="13"
      strokeLinecap="round"
    />
  </g>

  {/* Arms: rotate around the shoulders */}
  <g transform={`rotate(${pose.leftArm} 91 145)`}>
    <path
      d="M91 145 L67 185 L73 211"
      fill="none"
      stroke={skin}
      strokeWidth="19"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="73" cy="211" r="10" fill={skin} />
  </g>

  <g transform={`rotate(${pose.rightArm} 149 145)`}>
    <path
      d="M149 145 L173 185 L167 211"
      fill="none"
      stroke={skin}
      strokeWidth="19"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="167" cy="211" r="10" fill={skin} />
  </g>

  {/* Torso */}
  <g transform={`rotate(${pose.body} 120 145)`}>
    <path
      d="M96 132 Q120 121 144 132 L155 218 Q120 232 85 218 Z"
      fill={shirt}
    />
    <path
      d="M108 132 Q120 147 132 132"
      fill="none"
      stroke={skin}
      strokeWidth="7"
      strokeLinecap="round"
    />
  </g>

  {/* Neck */}
  <rect
    x="108"
    y="112"
    width="24"
    height="29"
    rx="8"
    fill={skin}
  />

  {/* Head: rotate around the neck */}
  <g transform={`rotate(${pose.head} 120 118)`}>
    <ellipse cx="120" cy="79" rx="39" ry="45" fill={skin} />

    {/* Ears */}
    <ellipse cx="81" cy="83" rx="7" ry="11" fill={skin} />
    <ellipse cx="159" cy="83" rx="7" ry="11" fill={skin} />

    {/* Hair */}
    {hairstyle === "Long" ? (
      <>
        <path
          d="M81 82 Q73 25 120 27 Q167 25 159 82 L155 132 L143 132 L145 75 Q120 91 95 75 L97 132 L85 132 Z"
          fill={hair}
        />
      </>
    ) : hairstyle === "Curly" ? (
      <>
        <path
          d="M83 69 Q72 34 99 30 Q108 12 125 27 Q151 17 159 48 Q169 61 157 80 L148 65 L137 54 L120 62 L101 53 L91 75 Z"
          fill={hair}
        />
        <circle cx="91" cy="42" r="11" fill={hair} />
        <circle cx="110" cy="31" r="12" fill={hair} />
        <circle cx="132" cy="32" r="12" fill={hair} />
        <circle cx="150" cy="43" r="12" fill={hair} />
      </>
    ) : (
      <path
        d="M82 74 Q75 27 120 28 Q165 27 158 74 L145 61 L132 54 L119 59 L104 52 L94 66 Z"
        fill={hair}
      />
    )}

    {/* Eyes */}
    <ellipse cx="106" cy="81" rx="4" ry="5" fill="#24242C" />
    <ellipse cx="134" cy="81" rx="4" ry="5" fill="#24242C" />

    {/* Eyebrows */}
    <path
      d="M97 70 L113 69 M127 69 L143 70"
      stroke={hair}
      strokeWidth="3"
      strokeLinecap="round"
    />

    {/* Nose */}
    <path
      d="M120 83 L116 96 L122 97"
      fill="none"
      stroke="#A86F55"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Smile */}
    <path
      d="M108 106 Q120 115 132 106"
      fill="none"
      stroke="#753D38"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </g>
</svg>

);
}
