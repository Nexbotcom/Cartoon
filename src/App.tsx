import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Download,
  Eye,
  FolderOpen,
  Hand,
  Image,
  Layers,
  Maximize2,
  Mic,
  Minus,
  Move,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shirt,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import "./App.css";

type Character = {
  id: number;
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  hairstyle: string;
  pose: string;
};

const initialCharacter: Character = {
  id: 1,
  name: "Alex",
  skin: "#D99B72",
  hair: "#30231E",
  shirt: "#7C6CF0",
  pants: "#303B55",
  shoes: "#24242C",
  hairstyle: "Short",
  pose: "Standing",
};

const colorOptions = [
  "#D99B72",
  "#F1C6A5",
  "#A96742",
  "#78472F",
  "#583525",
  "#E7B78C",
];

const hairOptions = [
  "#30231E",
  "#171717",
  "#68402C",
  "#A66B36",
  "#D8B16A",
  "#E7E7E7",
];

const shirtOptions = [
  "#7C6CF0",
  "#E75C67",
  "#3D9B82",
  "#E4A94B",
  "#3984D9",
  "#25252D",
  "#F2F2F2",
];

const pantsOptions = [
  "#303B55",
  "#24242B",
  "#6E513E",
  "#426A57",
  "#8A8A94",
  "#D5D5D5",
];

const shoeOptions = [
  "#24242C",
  "#F4F4F4",
  "#B64040",
  "#4567A4",
  "#A16A3D",
];

function CharacterArt({
  character,
  animated = false,
}: {
  character: Character;
  animated?: boolean;
}) {
  const isSitting = character.pose === "Sitting";
  const isRunning = character.pose === "Running";
  const isWaving = character.pose === "Waving";

  return (
    <svg
      className={animated ? "character-art character-bounce" : "character-art"}
      viewBox="0 0 240 360"
      role="img"
      aria-label={`${character.name}, cartoon character`}
    >
      <defs>
        <linearGradient id="skinLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={character.skin} />
          <stop offset="100%" stopColor={character.skin} />
        </linearGradient>
      </defs>

      {/* Legs */}
      {isSitting ? (
        <>
          <path
            d="M92 230 L65 260 L120 281"
            stroke={character.pants}
            strokeWidth="29"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M145 230 L173 257 L132 281"
            stroke={character.pants}
            strokeWidth="29"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <path
            d={
              isRunning
                ? "M96 223 L72 270 L48 300"
                : "M96 223 L91 278 L88 315"
            }
            stroke={character.pants}
            strokeWidth="31"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <path
            d={
              isRunning
                ? "M145 223 L173 260 L200 280"
                : "M145 223 L151 278 L154 315"
            }
            stroke={character.pants}
            strokeWidth="31"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      )}

      {/* Shoes */}
      <path
        d={
          isSitting
            ? "M113 281 L132 281 L144 294 L108 294 Z"
            : isRunning
              ? "M48 300 L62 306 L42 322 L24 318 Q20 309 30 304 Z"
              : "M88 310 L105 310 L110 327 L75 327 Q70 320 80 315 Z"
        }
        fill={character.shoes}
      />

      <path
        d={
          isSitting
            ? "M120 281 L140 281 L154 294 L119 294 Z"
            : isRunning
              ? "M200 280 L216 278 L229 292 L205 298 L194 290 Z"
              : "M151 310 L169 310 L180 327 L145 327 Q139 320 148 315 Z"
        }
        fill={character.shoes}
      />

      {/* Arms */}
      <g
        className={animated ? "arm-motion" : ""}
        style={{ transformOrigin: "120px 160px" }}
      >
        <path
          d={
            isWaving
              ? "M91 143 L64 117 L56 77"
              : isRunning
                ? "M92 145 L65 172 L79 194"
                : "M91 145 L64 184 L72 212"
          }
          stroke={character.skin}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <path
          d={
            isWaving
              ? "M149 143 L178 111 L181 79"
              : isRunning
                ? "M149 145 L177 130 L194 150"
                : "M149 145 L177 184 L169 212"
          }
          stroke={character.skin}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {isWaving && (
          <path
            d="M181 79 L175 62 L185 53 L190 72 L199 57 L202 76 L212 67 L209 87 L193 95 Z"
            fill={character.skin}
          />
        )}
      </g>

      {/* Body */}
      <path
        d="M91 135 Q120 124 149 135 L160 219 Q120 237 80 219 Z"
        fill={character.shirt}
      />

      {/* Shirt details */}
      <path
        d="M110 135 L120 148 L130 135"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="3"
        fill="none"
      />

      <path
        d="M120 150 L120 211"
        stroke="rgba(255,255,255,0.13)"
        strokeWidth="2"
      />

      {/* Neck */}
      <rect
        x="107"
        y="112"
        width="26"
        height="31"
        rx="10"
        fill={character.skin}
      />

      {/* Ears */}
      <ellipse cx="78" cy="82" rx="10" ry="15" fill={character.skin} />
      <ellipse cx="162" cy="82" rx="10" ry="15" fill={character.skin} />

      {/* Head */}
      <ellipse
        cx="120"
        cy="78"
        rx="43"
        ry="53"
        fill="url(#skinLight)"
      />

      {/* Hair */}
      {character.hairstyle === "Curly" ? (
        <g fill={character.hair}>
          <circle cx="84" cy="43" r="16" />
          <circle cx="99" cy="31" r="17" />
          <circle cx="119" cy="28" r="18" />
          <circle cx="139" cy="33" r="17" />
          <circle cx="154" cy="46" r="16" />
          <path d="M78 55 Q70 31 94 25 L145 25 Q169 33 162 59 L153 49 L146 62 L135 49 L121 60 L107 48 L95 59 L86 50 Z" />
        </g>
      ) : character.hairstyle === "Long" ? (
        <path
          d="M78 83 L77 44 Q81 21 120 23 Q160 21 163 47 L164 150 L146 141 L151 74 L88 74 L92 143 L76 150 Z"
          fill={character.hair}
        />
      ) : character.hairstyle === "Bald" ? null : (
        <path
          d="M78 78 L76 50 Q80 23 120 24 Q160 23 164 50 L162 79 L151 58 L142 48 L126 53 L108 45 L93 57 L85 73 Z"
          fill={character.hair}
        />
      )}

      {/* Eyes */}
      <ellipse cx="104" cy="79" rx="4" ry="6" fill="#27211E" />
      <ellipse cx="136" cy="79" rx="4" ry="6" fill="#27211E" />

      {/* Nose */}
      <path
        d="M120 82 L116 96 L122 97"
        stroke="#9A6247"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Smile */}
      <path
        d="M107 105 Q120 115 133 105"
        stroke="#6E3D32"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Eyebrows */}
      <path
        d="M97 69 L110 67 M130 67 L143 69"
        stroke={character.hair}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const [character, setCharacter] = useState<Character>(initialCharacter);

  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const stored = localStorage.getItem("cartoon-studio-characters");
      return stored ? JSON.parse(stored) : [initialCharacter];
    } catch {
      return [initialCharacter];
    }
  });

  const [projectName, setProjectName] = useState("My First Animation");
  const [activeTab, setActiveTab] = useState("Character");
  const [selectedPart, setSelectedPart] = useState("Body");
  const [hairstyle, setHairstyle] = useState("Short");
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [duration, setDuration] = useState(10);
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [status, setStatus] = useState("Ready to create");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!playing) return;

    const timer = window.setInterval(() => {
      setFrame((current) => (current >= duration * 24 ? 0 : current + 1));
    }, 1000 / 24);

    return () => window.clearInterval(timer);
  }, [playing, duration]);

  useEffect(() => {
    setCharacter((current) => ({ ...current, hairstyle }));
  }, [hairstyle]);

  function updateCharacter(
    property: keyof Character,
    value: string
  ) {
    setCharacter((current) => ({
      ...current,
      [property]: value,
    }));

    setSaved(false);
  }

  function saveProject() {
    try {
      localStorage.setItem(
        "cartoon-studio-project",
        JSON.stringify({
          projectName,
          character,
          characters,
          frame,
          duration,
          version: 1,
        })
      );

      localStorage.setItem(
        "cartoon-studio-characters",
        JSON.stringify(characters)
      );

      setSaved(true);
      setStatus("Project saved in this browser");
    } catch {
      setStatus("Unable to save. Check browser storage.");
    }
  }

  function saveCharacter() {
    const existing = characters.some((item) => item.id === character.id);

    const updated = existing
      ? characters.map((item) =>
          item.id === character.id ? { ...character } : item
        )
      : [...characters, { ...character, id: Date.now() }];

    setCharacters(updated);

    try {
      localStorage.setItem(
        "cartoon-studio-characters",
        JSON.stringify(updated)
      );

      setStatus("Character saved to your library");
    } catch {
      setStatus("Unable to save character");
    }
  }

  function createCharacter() {
    const newCharacter: Character = {
      ...initialCharacter,
      id: Date.now(),
      name: `Character ${characters.length + 1}`,
    };

    setCharacter(newCharacter);
    setHairstyle(newCharacter.hairstyle);
    setCharacters((current) => [...current, newCharacter]);
    setStatus("New character created");
  }

  function exportProject() {
    const data = {
      projectName,
      character,
      characters,
      frame,
      duration,
      version: 1,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${projectName.replace(/[^a-z0-9-_]/gi, "-")}.json`;
    link.click();

    URL.revokeObjectURL(url);
    setStatus("Project exported as JSON");
  }

  function importProject(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));

        if (!data.character || !data.projectName) {
          throw new Error("Invalid project");
        }

        setProjectName(data.projectName);
        setCharacter(data.character);
        setHairstyle(data.character.hairstyle || "Short");

        if (Array.isArray(data.characters)) {
          setCharacters(data.characters);
        }

        setFrame(Number(data.frame) || 0);
        setDuration(Number(data.duration) || 10);
        setStatus("Project imported successfully");
      } catch {
        setStatus("This file is not a valid Cartoon Studio project");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function exportCharacterPNG() {
    const svg = document.querySelector(".character-art");

    if (!(svg instanceof SVGElement)) {
      setStatus("Character artwork not found");
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const source = new XMLSerializer().serializeToString(clone);
    const imageBlob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(imageBlob);
    const imageElement = new window.Image();

    imageElement.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1080;

      const context = canvas.getContext("2d");

      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;

        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = pngUrl;
        link.download = `${character.name.replace(/\s+/g, "-")}.png`;
        link.click();

        URL.revokeObjectURL(pngUrl);
      });

      URL.revokeObjectURL(url);
      setStatus("Character PNG exported");
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus("Unable to export character image");
    };

    imageElement.src = url;
  }

  function chooseCharacter(item: Character) {
    setCharacter({ ...item });
    setHairstyle(item.hairstyle);
    setStatus(`${item.name} selected`);
  }

  const currentSeconds = (frame / 24).toFixed(2);

  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clapperboard size={21} />
          </div>

          <div className="brand-copy">
            <strong>cartoon<span>.</span></strong>
            <small>ANIMATION STUDIO</small>
          </div>
        </div>

        <div className="project-heading">
          <input
            aria-label="Project name"
            value={projectName}
            onChange={(event) => {
              setProjectName(event.target.value);
              setSaved(false);
            }}
          />

          <span className="save-state">
            <span className={saved ? "state-dot saved" : "state-dot"} />
            {saved ? "Saved" : "Unsaved changes"}
          </span>
        </div>

        <div className="top-actions">
          <button
            className="icon-button"
            title="Undo"
            onClick={() => setStatus("Undo history will be added later")}
          >
            <Undo2 size={17} />
          </button>

          <button
            className="icon-button"
            title="Redo"
            onClick={() => setStatus("Redo history will be added later")}
          >
            <Redo2 size={17} />
          </button>

          <span className="top-divider" />

          <button className="secondary-button" onClick={saveProject}>
            <Save size={15} />
            <span>Save</span>
          </button>

          <button className="primary-button" onClick={exportProject}>
            <Download size={15} />
            <span>Export project</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-panel">
          <div className="panel-title">
            <span>WORKSPACE</span>
            <button
              className="subtle-icon"
              title="Search assets"
              onClick={() => setStatus("Asset search coming soon")}
            >
              <Search size={16} />
            </button>
          </div>

          <button
            className={`nav-item ${activeTab === "Character" ? "active" : ""}`}
            onClick={() => setActiveTab("Character")}
          >
            <UserRound size={17} />
            Characters
            <span className="nav-count">{characters.length}</span>
          </button>

          <button
            className={`nav-item ${activeTab === "Scenes" ? "active" : ""}`}
            onClick={() => setActiveTab("Scenes")}
          >
            <Image size={17} />
            Scenes
          </button>

          <button
            className={`nav-item ${activeTab === "Props" ? "active" : ""}`}
            onClick={() => setActiveTab("Props")}
          >
            <Layers size={17} />
            Props & layers
          </button>

          <button
            className={`nav-item ${activeTab === "Audio" ? "active" : ""}`}
            onClick={() => setActiveTab("Audio")}
          >
            <Music size={17} />
            Audio
          </button>

          <div className="sidebar-divider" />

          <div className="panel-title library-title">
            <span>
              {activeTab === "Character"
                ? "CHARACTER LIBRARY"
                : activeTab === "Scenes"
                  ? "SCENE LIBRARY"
                  : activeTab === "Props"
                    ? "SCENE LAYERS"
                    : "AUDIO TRACKS"}
            </span>

            <button
              className="subtle-icon"
              title="Add item"
              onClick={() => {
                if (activeTab === "Character") {
                  createCharacter();
                } else {
                  setStatus(`${activeTab} library is coming soon`);
                }
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {activeTab === "Character" ? (
            <>
              <div className="character-list">
                {characters.map((item) => (
                  <button
                    key={item.id}
                    className={`character-card ${
                      character.id === item.id ? "selected" : ""
                    }`}
                    onClick={() => chooseCharacter(item)}
                  >
                    <div className="character-thumb">
                      <CharacterArt character={item} />
                    </div>

                    <div className="character-card-info">
                      <strong>{item.name}</strong>
                      <span>{item.hairstyle} · Cartoon</span>
                    </div>

                    {character.id === item.id && (
                      <Check className="character-check" size={15} />
                    )}
                  </button>
                ))}
              </div>

              <button className="add-character" onClick={createCharacter}>
                <Plus size={16} />
                Create character
              </button>
            </>
          ) : (
            <div className="empty-library">
              <div className="empty-icon">
                {activeTab === "Scenes" ? (
                  <Image size={22} />
                ) : activeTab === "Props" ? (
                  <Layers size={22} />
                ) : (
                  <Music size={22} />
                )}
              </div>

              <strong>
                {activeTab === "Scenes"
                  ? "Your scenes"
                  : activeTab === "Props"
                    ? "Your layers"
                    : "Your audio"}
              </strong>

              <p>
                {activeTab === "Scenes"
                  ? "Scene templates will be added in a future update."
                  : activeTab === "Props"
                    ? "Organize backgrounds and objects here in a future update."
                    : "Dialogue and sound editing will be added later."}
              </p>
            </div>
          )}

          <div className="sidebar-bottom">
            <div className="storage-card">
              <div className="storage-icon">
                <FolderOpen size={17} />
              </div>

              <div>
                <strong>Local workspace</strong>
                <span>Saved in this browser</span>
              </div>

              <Check size={15} />
            </div>

            <button
              className="help-link"
              onClick={() => setStatus("More editing tools are coming soon")}
            >
              <CircleHelp size={16} />
              Help & shortcuts
            </button>
          </div>
        </aside>

        <section className="main-area">
          <div className="stage-toolbar">
            <div className="breadcrumb">
              <span>Projects</span>
              <span className="crumb-slash">/</span>
              <strong>Scene 01</strong>
              <ChevronDown size={14} />
            </div>

            <div className="stage-tools">
              <button
                className="tool-button active-tool"
                title="Select"
                onClick={() => setStatus("Select tool active")}
              >
                <Move size={16} />
              </button>

              <button
                className="tool-button"
                title="Hand tool"
                onClick={() => setStatus("Hand tool selected")}
              >
                <Hand size={16} />
              </button>

              <span className="top-divider" />

              <button
                className="tool-button"
                title="Zoom out"
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
              >
                <ZoomOut size={16} />
              </button>

              <button
                className="zoom-label"
                onClick={() => setZoom(100)}
              >
                {zoom}%
              </button>

              <button
                className="tool-button"
                title="Zoom in"
                onClick={() => setZoom((value) => Math.min(150, value + 10))}
              >
                <ZoomIn size={16} />
              </button>

              <button
                className="tool-button"
                title="Reset zoom"
                onClick={() => setZoom(100)}
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div className="stage-area">
            <div className="stage-label">
              <span className="live-dot" />
              SCENE VIEW
            </div>

            <div
              className={`scene-canvas ${showGrid ? "show-grid" : ""}`}
              style={{ "--stage-zoom": zoom / 100 } as React.CSSProperties}
            >
              <div className="scene-background" />

              <div className="scene-sun" />

              <div className="scene-cloud cloud-one" />
              <div className="scene-cloud cloud-two" />

              <div className="scene-hill hill-back" />
              <div className="scene-hill hill-front" />

              <div className="scene-ground" />

              <div className="character-shadow" />

              <div className="scene-character">
                <CharacterArt character={character} animated={playing} />
              </div>

              <div className="selection-box">
                <span className="selection-handle handle-top" />
                <span className="selection-handle handle-right" />
                <span className="selection-handle handle-bottom" />
                <span className="selection-handle handle-left" />
              </div>

              <div className="stage-watermark">
                <Sparkles size={12} />
                CARTOON STUDIO
              </div>
            </div>

            <div className="stage-footer">
              <div className="stage-footer-left">
                <span className="status-indicator" />
                <span>{status}</span>
              </div>

              <div className="stage-footer-right">
                <button
                  className={`mini-toggle ${showGrid ? "toggle-on" : ""}`}
                  onClick={() => setShowGrid((value) => !value)}
                >
                  <Activity size={14} />
                  Grid
                </button>

                <button
                  className="mini-toggle"
                  onClick={exportCharacterPNG}
                >
                  <Download size={14} />
                  PNG
                </button>
              </div>
            </div>
          </div>

          <section className="timeline">
            <div className="timeline-header">
              <div className="timeline-heading">
                <span>ANIMATION TIMELINE</span>
                <span className="timeline-scene">Scene 01</span>
              </div>

              <div className="timeline-controls">
                <button
                  className="icon-button small"
                  title="Reset timeline"
                  onClick={() => {
                    setFrame(0);
                    setPlaying(false);
                  }}
                >
                  <RotateCcw size={15} />
                </button>

                <button
                  className="play-button"
                  title={playing ? "Pause" : "Play"}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>

                <span className="time-display">
                  {currentSeconds}s <span>/</span> {duration.toFixed(2)}s
                </span>

                <button
                  className="icon-button small"
                  title="Increase duration"
                  onClick={() =>
                    setDuration((value) => Math.min(60, value + 5))
                  }
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="timeline-body">
              <div className="track-labels">
                <div className="track-label track-main">
                  <UserRound size={14} />
                  <span>{character.name}</span>
                  <Eye size={13} />
                </div>

                <div className="track-label">
                  <Camera size={14} />
                  <span>Camera</span>
                  <Eye size={13} />
                </div>

                <div className="track-label">
                  <Mic size={14} />
                  <span>Dialogue</span>
                  <Eye size={13} />
                </div>
              </div>

              <div className="track-scroll">
                <div className="ruler">
                  {Array.from({ length: duration + 1 }, (_, index) => (
                    <div className="ruler-mark" key={index}>
                      <span>{index}s</span>
                      <i />
                    </div>
                  ))}
                </div>

                <div className="track-row">
                  <div className="track-strip character-track">
                    <button
                      className="keyframe"
                      style={{ left: "2%" }}
                      title="Keyframe at start"
                      onClick={() => setFrame(0)}
                    />

                    <button
                      className="keyframe"
                      style={{ left: "48%" }}
                      title="Keyframe at midpoint"
                      onClick={() => setFrame(Math.floor(duration * 12))}
                    />

                    <button
                      className="keyframe"
                      style={{ left: "94%" }}
                      title="Keyframe at end"
                      onClick={() => setFrame(duration * 24)}
                    />
                  </div>
                </div>

                <div className="track-row">
                  <div className="track-strip camera-track">
                    <span className="track-empty-label">No camera keyframes</span>
                  </div>
                </div>

                <div className="track-row">
                  <div className="track-strip audio-track">
                    <span className="track-empty-label">No dialogue clips</span>
                  </div>
                </div>

                <button
                  className="playhead"
                  style={{
                    left: `calc(${(frame / (duration * 24 || 1)) * 100}% + 104px)`,
                  }}
                  aria-label="Timeline playhead"
                  onClick={() => setFrame(0)}
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="timeline-footer">
              <span>24 FPS</span>
              <span className="footer-separator">·</span>
              <span>{duration * 24} frames</span>

              <div className="timeline-slider">
                <button
                  className="icon-button small"
                  title="Previous frame"
                  onClick={() => setFrame((value) => Math.max(0, value - 1))}
                >
                  <Minus size={13} />
                </button>

                <input
                  aria-label="Current animation frame"
                  type="range"
                  min={0}
                  max={duration * 24}
                  value={Math.min(frame, duration * 24)}
                  onChange={(event) => {
                    setFrame(Number(event.target.value));
                    setPlaying(false);
                  }}
                />

                <button
                  className="icon-button small"
                  title="Next frame"
                  onClick={() =>
                    setFrame((value) => Math.min(duration * 24, value + 1))
                  }
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </section>
        </section>

        <aside className="right-panel">
          <div className="properties-header">
            <div>
              <span className="properties-eyebrow">INSPECTOR</span>
              <h2>Properties</h2>
            </div>

            <button
              className="subtle-icon"
              title="Inspector settings"
              onClick={() => setStatus("Inspector settings")}
            >
              <Settings2 size={17} />
            </button>
          </div>

          <div className="selected-object">
            <div className="selected-object-icon">
              <UserRound size={17} />
            </div>

            <div>
              <strong>{character.name}</strong>
              <span>Character · Vector</span>
            </div>

            <button
              className="subtle-icon"
              title="Delete character"
              onClick={() => {
                if (characters.length <= 1) {
                  setStatus("Keep at least one character in your library");
                  return;
                }

                const updated = characters.filter(
                  (item) => item.id !== character.id
                );

                setCharacters(updated);
                setCharacter(updated[0]);
                setHairstyle(updated[0].hairstyle);
                setStatus("Character removed from library");
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="property-section">
            <button
              className="section-heading"
              onClick={() => setStatus("Transform controls selected")}
            >
              <span>
                <Move size={15} />
                Transform
              </span>
              <ChevronDown size={15} />
            </button>

            <div className="property-grid">
              <label className="field-label">
                Position X
                <input type="number" defaultValue="0" />
              </label>

              <label className="field-label">
                Position Y
                <input type="number" defaultValue="0" />
              </label>

              <label className="field-label">
                Scale
                <input type="number" defaultValue="100" />
              </label>

              <label className="field-label">
                Rotation
                <input type="number" defaultValue="0" />
              </label>
            </div>
          </div>

          <div className="property-section">
            <button
              className="section-heading"
              onClick={() => setStatus("Appearance controls selected")}
            >
              <span>
                <PaletteIcon />
                Appearance
              </span>
              <ChevronDown size={15} />
            </button>

            <div className="appearance-tabs">
              {[
                ["Body", <UserRound size={14} key="body" />],
                ["Hair", <Sparkles size={14} key="hair" />],
                ["Clothes", <Shirt size={14} key="clothes" />],
              ].map(([label, icon]) => (
                <button
                  key={String(label)}
                  className={`appearance-tab ${
                    selectedPart === label ? "selected-tab" : ""
                  }`}
                  onClick={() => setSelectedPart(String(label))}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {selectedPart === "Body" && (
              <div className="color-property">
                <div className="property-label">
                  <span>Skin tone</span>
                  <span className="hex-value">{character.skin}</span>
                </div>

                <div className="color-options">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      title={color}
                      className={`color-swatch ${
                        character.skin === color ? "selected-swatch" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => updateCharacter("skin", color)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedPart === "Hair" && (
              <>
                <div className="color-property">
                  <div className="property-label">
                    <span>Hair color</span>
                    <span className="hex-value">{character.hair}</span>
                  </div>

                  <div className="color-options">
                    {hairOptions.map((color) => (
                      <button
                        key={color}
                        title={color}
                        className={`color-swatch ${
                          character.hair === color ? "selected-swatch" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateCharacter("hair", color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="color-property">
                  <div className="property-label">
                    <span>Hairstyle</span>
                  </div>

                  <select
                    value={character.hairstyle}
                    onChange={(event) => {
                      setHairstyle(event.target.value);
                      updateCharacter("hairstyle", event.target.value);
                    }}
                  >
                    <option>Short</option>
                    <option>Curly</option>
                    <option>Long</option>
                    <option>Bald</option>
                  </select>
                </div>
              </>
            )}

            {selectedPart === "Clothes" && (
              <>
                <div className="color-property">
                  <div className="property-label">
                    <span>Shirt color</span>
                    <span className="hex-value">{character.shirt}</span>
                  </div>

                  <div className="color-options">
                    {shirtOptions.map((color) => (
                      <button
                        key={color}
                        title={color}
                        className={`color-swatch ${
                          character.shirt === color ? "selected-swatch" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateCharacter("shirt", color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="color-property">
                  <div className="property-label">
                    <span>Trousers</span>
                    <span className="hex-value">{character.pants}</span>
                  </div>

                  <div className="color-options">
                    {pantsOptions.map((color) => (
                      <button
                        key={color}
                        title={color}
                        className={`color-swatch ${
                          character.pants === color ? "selected-swatch" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateCharacter("pants", color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="color-property">
                  <div className="property-label">
                    <span>Shoes</span>
                    <span className="hex-value">{character.shoes}</span>
                  </div>

                  <div className="color-options">
                    {shoeOptions.map((color) => (
                      <button
                        key={color}
                        title={color}
                        className={`color-swatch ${
                          character.shoes === color ? "selected-swatch" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateCharacter("shoes", color)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="property-section">
            <button className="section-heading">
              <span>
                <Activity size={15} />
                Pose & movement
              </span>
              <ChevronDown size={15} />
            </button>

            <div className="property-label pose-label">
              <span>Character pose</span>
            </div>

            <div className="pose-options">
              {["Standing", "Waving", "Running", "Sitting"].map((pose) => (
                <button
                  key={pose}
                  className={`pose-option ${
                    character.pose === pose ? "pose-selected" : ""
                  }`}
                  onClick={() => updateCharacter("pose", pose)}
                >
                  {pose === "Standing" ? (
                    <UserRound size={16} />
                  ) : pose === "Waving" ? (
                    <Hand size={16} />
                  ) : pose === "Running" ? (
                    <Activity size={16} />
                  ) : (
                    <Minus size={16} />
                  )}

                  {pose}
                </button>
              ))}
            </div>
          </div>

          <div className="property-section name-section">
            <label className="field-label">
              Character name

              <input
                value={character.name}
                onChange={(event) =>
                  updateCharacter("name", event.target.value)
                }
              />
            </label>
          </div>

          <div className="inspector-actions">
            <button className="secondary-button full-button" onClick={saveCharacter}>
              <Check size={15} />
              Save to character library
            </button>

            <button
              className="text-button"
              onClick={() => {
                setCharacter({ ...initialCharacter, id: character.id });
                setHairstyle(initialCharacter.hairstyle);
                setStatus("Character appearance reset");
              }}
            >
              <RotateCcw size={14} />
              Reset appearance
            </button>
          </div>

          <div className="inspector-footer">
            <span>
              <span className="online-dot" />
              All systems ready
            </span>

            <button
              title="More options"
              className="subtle-icon"
              onClick={() => setStatus("More options coming soon")}
            >
              <Settings2 size={14} />
            </button>
          </div>
        </aside>
      </div>

      <footer className="bottom-bar">
        <div className="bottom-brand">
          <span className="bottom-brand-dot" />
          CARTOON STUDIO <span className="version">v0.1</span>
        </div>

        <div className="bottom-message">
          <Sparkles size={13} />
          Your next story starts here.
        </div>

        <div className="bottom-actions">
          <label className="import-button">
            <FolderOpen size={14} />
            Import project
            <input
              type="file"
              accept=".json,application/json"
              onChange={importProject}
              hidden
            />
          </label>

          <button
            className="subtle-icon"
            title="More options"
            onClick={() => setStatus("More options coming soon")}
          >
            <Settings2 size={15} />
          </button>
        </div>
      </footer>
    </main>
  );
}

function PaletteIcon() {
  return <Sparkles size={15} />;
}

export default App;
