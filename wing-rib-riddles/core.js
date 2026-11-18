// Wing Rib Riddles: the pictures, the riddle of the day, answer choices and streaks.
// No screen code here, so it can be tested with Node. Every picture is drawn in code, so nothing is downloaded.
(function (root) {
  "use strict";

  // ---------- random numbers (seedable, so a given day always gives the same riddle) ----------
  function makeRng(seed) {
    let s = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    const next = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      },
    };
  }

  // ---------- drawing helpers ----------
  // Colors: steel, light steel, dark steel, copper, brass, red, blue, green, yellow, rubber black, wood, white, orange, bench.
  const ST = "#A9B4BF", LT = "#D7DEE5", DK = "#5C6875", CU = "#C9793A", BR = "#D8A53F", RD = "#C8452F", BL = "#2E6DB4",
    GN = "#3C9A5F", YL = "#E8B93B", RB = "#2A2E33", WD = "#B88A58", WH = "#F7F4EC", OR = "#E07B2E", BG = "#EFE9DC";
  const INK = "#2B3642";
  const O = 'fill="none"';
  const r1 = (n) => Math.round(n * 10) / 10;
  // n evenly spaced copies of one short line (threads, ticks, knurling)
  const L = (x1, y1, x2, y2, n, dx, dy, w = 1.2, color = INK) => {
    let d = "";
    for (let i = 0; i < n; i++) d += `M${r1(x1 + i * dx)} ${r1(y1 + i * dy)} L${r1(x2 + i * dx)} ${r1(y2 + i * dy)} `;
    return `<path d="${d.trim()}" ${O} stroke="${color}" stroke-width="${w}"/>`;
  };
  // point on a circle, angle in degrees clockwise from straight up
  const polar = (cx, cy, r, deg) => [r1(cx + r * Math.sin(deg * Math.PI / 180)), r1(cy - r * Math.cos(deg * Math.PI / 180))];
  const ticks = (cx, cy, rIn, rOut, n, color = WH, w = 2, from = 0, sweep = 360) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = from + (sweep / n) * i, p = polar(cx, cy, rIn, a), q = polar(cx, cy, rOut, a);
      d += `M${p[0]} ${p[1]} L${q[0]} ${q[1]} `;
    }
    return `<path d="${d.trim()}" ${O} stroke="${color}" stroke-width="${w}"/>`;
  };
  const arc = (r, color, w, fromDeg, sweepDeg) => {
    const len = r1(2 * Math.PI * r * sweepDeg / 360);
    return `<circle cx="100" cy="100" r="${r}" ${O} stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-dasharray="${len} 999" transform="rotate(${fromDeg - 90} 100 100)"/>`;
  };
  const text = (x, y, s, size, color = WH, anchor = "middle") =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" text-anchor="${anchor}" fill="${color}" stroke="none">${s}</text>`;
  const star = (cx, cy, rOut, rIn, n) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 ? rIn : rOut, (180 / n) * i).join(","));
    return pts.join(" ");
  };

  // ---------- the riddles ----------
  // kind: "part" (on the airplane), "tool" (in the toolbox) or "gadget" (shop odds and ends).
  // zoom: the close-up window [x, y, size] inside the 200 x 200 drawing.
  const ITEMS = [
    {
      id: "cleco", name: "Cleco", kind: "gadget", zoom: [65, 118, 70],
      decoys: ["Spark plug", "Blind rivet", "Tire valve stem", "Grease fitting"],
      fact: "A cleco is a spring-loaded temporary fastener that holds sheets together until they are riveted. The color tells the size: silver is 3/32 inch, copper 1/8, black 5/32 and brass 3/16.",
      svg: `<rect x="91" y="26" width="18" height="50" fill="${ST}"/><rect x="83" y="16" width="34" height="13" rx="4" fill="${LT}"/>
        <rect x="80" y="72" width="40" height="66" rx="5" fill="${CU}"/><rect x="73" y="84" width="54" height="10" rx="3" fill="${DK}"/>
        <rect x="90" y="138" width="20" height="12" fill="${ST}"/>
        <path d="M96 150 V178 L92 186 M104 150 V178 L108 186" ${O}/><path d="M100 150 V172" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "rivet", name: "Solid rivet", kind: "part", zoom: [62, 48, 70],
      decoys: ["Carriage bolt", "Thumbtack", "Roofing nail", "Wood screw"],
      fact: "The dimple in the head marks the common \"AD\" aluminum rivet. In a part number like AN470AD4-5, the 4 is the diameter in 32nds of an inch and the 5 is the length in 16ths.",
      svg: `<rect x="84" y="92" width="32" height="84" fill="${ST}"/><path d="M56 94 A44 36 0 0 1 144 94 Z" fill="${LT}"/><circle cx="100" cy="72" r="4" fill="${DK}"/>`,
    },
    {
      id: "bucking-bar", name: "Bucking bar", kind: "tool", zoom: [118, 78, 66],
      decoys: ["Anvil", "Sanding block", "Wheel chock", "Sharpening stone"],
      fact: "The bucking bar is held against the tail of a rivet while the rivet gun hammers the head. Tungsten bars are more than twice as dense as steel, so a small one does the work of a big steel bar.",
      svg: `<path d="M36 112 H140 L160 152 H36 Z" fill="${ST}"/><path d="M36 112 L56 86 H160 L140 112 Z" fill="${LT}"/><path d="M140 112 L160 86 L180 126 L160 152 Z" fill="${DK}"/>
        <path d="M48 124 H120" ${O} stroke="${WH}" stroke-width="2"/>`,
    },
    {
      id: "rivet-gun", name: "Rivet gun", kind: "tool", zoom: [14, 42, 68],
      decoys: ["Cordless drill", "Glue gun", "Paint sprayer", "Staple gun"],
      fact: "A rivet gun is a small air hammer. Builders call the usual size a \"3X\" gun; it drives the 3/32 and 1/8 inch rivets that hold most of a kit airplane together.",
      svg: `<rect x="24" y="68" width="34" height="16" fill="${LT}"/><path d="M36 60 L40 92 L44 60 L48 92 L52 60 L56 92" ${O} stroke-width="2"/>
        <rect x="56" y="58" width="92" height="36" rx="12" fill="${ST}"/><path d="M112 92 H146 L156 160 H124 Z" fill="${DK}"/>
        <path d="M112 98 Q98 106 110 120" ${O}/><rect x="130" y="160" width="18" height="14" fill="${BR}"/>`,
    },
    {
      id: "pitot", name: "Pitot tube", kind: "part", zoom: [34, 74, 66],
      decoys: ["Radio antenna", "Fuel tank vent", "Static wick", "Tiedown ring"],
      fact: "Air rammed into the pitot tube drives the airspeed indicator. It is named for Henri Pitot, a French engineer who invented it in 1732 to measure how fast the Seine was flowing.",
      svg: `<rect x="20" y="24" width="160" height="18" fill="${LT}"/><path d="M112 42 H140 L134 104 H120 Z" fill="${ST}"/>
        <rect x="44" y="100" width="96" height="16" rx="8" fill="${ST}"/><circle cx="50" cy="108" r="3" fill="${RB}"/>`,
    },
    {
      id: "spark-plug", name: "Spark plug", kind: "part", zoom: [66, 112, 68],
      decoys: ["Cleco", "Fuel injector", "Oil pressure sender", "Grease fitting"],
      fact: "A piston airplane engine has two spark plugs in every cylinder, each fired by its own ignition system, so the engine keeps running if one system quits.",
      svg: `<rect x="92" y="14" width="16" height="18" rx="3" fill="${ST}"/><path d="M88 32 H112 L116 86 H84 Z" fill="${WH}"/><path d="M87 46 H113 M86 58 H114 M85 70 H115" ${O} stroke-width="1.5"/>
        <rect x="74" y="86" width="52" height="24" fill="${ST}"/><path d="M90 86 V110 M110 86 V110" ${O}/><rect x="80" y="110" width="40" height="7" fill="${DK}"/>
        <rect x="84" y="117" width="32" height="42" fill="${LT}"/>${L(84, 126, 116, 121, 5, 0, 7)}
        <path d="M100 159 V170 M84 159 V177 H104" ${O} stroke-width="4"/>`,
    },
    {
      id: "propeller", name: "Propeller", kind: "part", zoom: [64, 64, 72],
      decoys: ["Ceiling fan", "Boat propeller", "Wind turbine", "Helicopter rotor"],
      fact: "A propeller blade is a twisted wing. The tip travels much faster than the root, so the blade is angled steeply near the hub and flattens toward the tip to keep the whole blade pulling evenly.",
      svg: `<g transform="rotate(28 100 100)"><path d="M100 100 C78 78 84 34 100 10 C114 34 120 78 100 100 Z" fill="${RB}"/><path d="M100 100 C122 122 116 166 100 190 C86 166 80 122 100 100 Z" fill="${RB}"/>
        <path d="M91 30 H109 M91 170 H109" ${O} stroke="${YL}" stroke-width="5"/></g>
        <circle cx="100" cy="100" r="18" fill="${RD}"/><circle cx="94" cy="94" r="5" fill="${WH}" stroke="none" opacity=".6"/>`,
    },
    {
      id: "turnbuckle", name: "Turnbuckle", kind: "part", zoom: [36, 68, 64],
      decoys: ["Rod end bearing", "Shock absorber", "Fuel filter", "Push-pull tube"],
      fact: "Turning the barrel tightens a control cable, because one end has a left-hand thread and the other a right-hand thread. It is safe only when no more than three threads show outside the barrel.",
      svg: `<circle cx="18" cy="100" r="10" ${O} stroke-width="5"/><circle cx="182" cy="100" r="10" ${O} stroke-width="5"/>
        <rect x="28" y="96" width="32" height="8" fill="${ST}"/><rect x="140" y="96" width="32" height="8" fill="${ST}"/>${L(32, 96, 32, 104, 4, 5, 0)}${L(152, 96, 152, 104, 4, 5, 0)}
        <path d="M56 88 H144 L152 100 L144 112 H56 L48 100 Z" fill="${BR}"/><rect x="78" y="95" width="44" height="10" rx="5" fill="${BG}"/>
        <path d="M34 96 Q60 76 100 100 Q140 124 166 104" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "castle-nut", name: "Castle nut and cotter pin", kind: "part", zoom: [36, 52, 70],
      decoys: ["Wing nut", "Lock washer", "Wheel lug nut", "Hose clamp"],
      fact: "The slots that make it look like a castle tower line up with a hole drilled through the bolt. A cotter pin through both keeps the nut from backing off, which is why it is used on parts that rotate.",
      svg: `<rect x="86" y="30" width="28" height="52" fill="${LT}"/>${L(86, 40, 114, 37, 5, 0, 8)}
        <rect x="58" y="96" width="84" height="44" fill="${ST}"/><path d="M82 96 V140 M118 96 V140" ${O}/>
        <rect x="58" y="74" width="18" height="22" fill="${ST}"/><rect x="91" y="74" width="18" height="22" fill="${ST}"/><rect x="124" y="74" width="18" height="22" fill="${ST}"/>
        <rect x="50" y="140" width="100" height="8" fill="${DK}"/>
        <circle cx="40" cy="85" r="7" ${O}/><path d="M47 83 H150 Q162 80 164 68 M47 87 H150 Q162 90 164 102" ${O}/>`,
    },
    {
      id: "safety-wire-pliers", name: "Safety wire pliers", kind: "tool", zoom: [68, 96, 64],
      decoys: ["Needle-nose pliers", "Wire stripper", "Hemostat", "Tin snips"],
      fact: "Lock the jaws on the wire, pull the knob, and the spiral rod spins the pliers to twist the wire. Safety wire is always routed so that it pulls the bolt in the tightening direction.",
      svg: `<path d="M100 22 L96 14 L104 8 L96 2" ${O} stroke-width="2"/>
        <path d="M92 84 L62 172" ${O} stroke="${RD}" stroke-width="13"/><path d="M108 84 L138 172" ${O} stroke="${RD}" stroke-width="13"/>
        <path d="M93 84 L88 34 L100 22 L112 34 L107 84 Z" fill="${ST}"/><path d="M100 22 V70" ${O} stroke-width="1.5"/>
        <rect x="95" y="92" width="10" height="78" fill="${LT}"/>${L(95, 103, 105, 97, 8, 0, 9)}
        <circle cx="100" cy="178" r="9" fill="${DK}"/><circle cx="100" cy="84" r="6" fill="${DK}"/>`,
    },
    {
      id: "torque-wrench", name: "Torque wrench", kind: "tool", zoom: [104, 70, 60],
      decoys: ["Ratchet wrench", "Breaker bar", "Tire pressure gauge", "Grease gun"],
      fact: "Airplane bolts are tightened by the numbers, and the numbers are small. The little AN3 bolt found all over a kit airplane takes only 20 to 25 inch-pounds, about what two fingers can do.",
      svg: `<circle cx="34" cy="100" r="17" fill="${ST}"/><rect x="27" y="93" width="14" height="14" fill="${DK}"/><rect x="50" y="94" width="76" height="12" fill="${LT}"/>
        <rect x="122" y="89" width="20" height="22" fill="${YL}"/><path d="M127 89 v8 M132 89 v12 M137 89 v8" ${O} stroke-width="1.5"/>
        <rect x="142" y="86" width="50" height="28" rx="8" fill="${RB}"/>${L(154, 91, 154, 109, 4, 9, 0, 1.5, ST)}`,
    },
    {
      id: "dimple-dies", name: "Dimple dies", kind: "tool", zoom: [66, 66, 68],
      decoys: ["Hole punch", "Countersink bit", "Grommet press", "Socket set"],
      fact: "Thin skin is too thin to countersink, so the two dies press a little cone into it for a flush rivet to sit in. Aircraft flush rivets use a 100-degree cone; hardware-store screws use 82.",
      svg: `<rect x="93" y="14" width="14" height="26" fill="${DK}"/><rect x="93" y="160" width="14" height="26" fill="${DK}"/>
        <path d="M62 40 H138 V84 H112 L100 74 L88 84 H62 Z" fill="${ST}"/><path d="M62 160 H138 V116 H112 L104 106 H96 L88 116 H62 Z" fill="${ST}"/>
        <rect x="18" y="96" width="76" height="5" fill="${LT}" stroke-width="1.5"/><rect x="106" y="96" width="76" height="5" fill="${LT}" stroke-width="1.5"/>
        <rect x="98" y="86" width="4" height="20" fill="${DK}" stroke-width="1"/>`,
    },
    {
      id: "countersink-cage", name: "Countersink cage", kind: "tool", zoom: [64, 104, 72],
      decoys: ["Hole saw", "Drill chuck", "Pencil sharpener", "Flashlight"],
      fact: "Also called a microstop. The cage rests on the skin and stops the cutter at a set depth, adjustable in steps of one thousandth of an inch, so every flush rivet sits exactly level.",
      svg: `<rect x="94" y="12" width="12" height="44" fill="${ST}"/><rect x="74" y="54" width="52" height="34" rx="4" fill="${DK}"/>${L(82, 57, 82, 85, 6, 7.2, 0, 1.5, RB)}
        <rect x="70" y="86" width="60" height="12" rx="3" fill="${BR}"/><path d="M76 98 H124 L130 156 H70 Z" fill="${LT}"/>
        <rect x="89" y="112" width="22" height="26" rx="3" fill="${BG}"/><path d="M100 113 V137" ${O} stroke="${DK}" stroke-width="6" stroke-linecap="butt"/>
        <path d="M92 156 L100 172 L108 156 Z" fill="${ST}"/>`,
    },
    {
      id: "step-drill", name: "Step drill", kind: "tool", zoom: [62, 100, 72],
      decoys: ["Tapered reamer", "Countersink bit", "Thread tap", "Wood auger bit"],
      fact: "One step drill makes many hole sizes. In thin sheet metal it leaves a clean round hole, where an ordinary twist drill tends to grab and leave a hole with three rounded corners.",
      svg: `<rect x="92" y="12" width="16" height="42" fill="${ST}"/>${[0, 1, 2, 3, 4, 5].map((i) => { const w = 72 - i * 11; return `<rect x="${100 - w / 2}" y="${54 + i * 17}" width="${w}" height="17" fill="${BR}"/>`; }).join("")}
        <path d="M91.5 156 L100 180 L108.5 156 Z" fill="${BR}"/><path d="M114 56 L97 156" ${O} stroke-width="2"/>`,
    },
    {
      id: "aviation-snips", name: "Aviation snips", kind: "tool", zoom: [66, 64, 68],
      decoys: ["Kitchen shears", "Bolt cutters", "Pruning shears", "Wire stripper"],
      fact: "The handle color tells which way they cut curves: red cuts to the left, green cuts to the right, and yellow cuts straight. Just like the red and green lights on the wingtips.",
      svg: `<path d="M95 100 Q64 132 76 178" ${O} stroke="${GN}" stroke-width="14"/><path d="M105 100 Q136 132 124 178" ${O} stroke="${GN}" stroke-width="14"/>
        <path d="M97 96 L78 28 L92 22 L106 92 Z" fill="${ST}"/><path d="M103 96 L122 28 L108 22 L94 92 Z" fill="${LT}"/><circle cx="100" cy="98" r="7" fill="${DK}"/>`,
    },
    {
      id: "wing-rib", name: "Wing rib", kind: "part", zoom: [30, 62, 64],
      decoys: ["Wing spar", "Fuselage bulkhead", "Propeller blade", "Shelf bracket"],
      fact: "Ribs give the wing its airfoil shape. The big \"lightening holes\" do two jobs: they remove weight, and the flange pressed around each hole makes the thin rib stiffer than a solid one.",
      svg: `<path d="M16 112 C24 72 78 56 112 62 C146 68 172 92 186 112 L186 120 C150 124 60 128 16 120 Z" fill="${LT}"/>
        <circle cx="58" cy="96" r="21" ${O} stroke-width="1.2"/><circle cx="101" cy="93" r="20" ${O} stroke-width="1.2"/><circle cx="140" cy="100" r="14" ${O} stroke-width="1.2"/>
        <circle cx="58" cy="96" r="16" fill="${BG}"/><circle cx="101" cy="93" r="15" fill="${BG}"/><circle cx="140" cy="100" r="10" fill="${BG}"/>
        <path d="M162 110 h14" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "rod-end", name: "Rod end bearing", kind: "part", zoom: [68, 28, 64],
      decoys: ["Eye bolt", "Turnbuckle", "Tiedown ring", "Tow hook"],
      fact: "The ball in the eye swivels, so a pushrod can move a control surface without binding. Mechanics often call it a Heim joint, after the American company that made them during World War II.",
      svg: `<rect x="88" y="104" width="24" height="76" fill="${LT}"/>${L(88, 132, 112, 128, 6, 0, 8)}<rect x="78" y="106" width="44" height="16" fill="${DK}"/>
        <path d="M90 84 H110 V106 H90 Z" fill="${ST}"/><circle cx="100" cy="58" r="32" fill="${ST}"/><circle cx="100" cy="58" r="19" fill="${BR}"/><circle cx="100" cy="58" r="9" fill="${BG}"/>`,
    },
    {
      id: "nutplate", name: "Nutplate", kind: "part", zoom: [68, 68, 64],
      decoys: ["Flat washer", "Hose clamp", "Ring terminal", "Cabinet hinge"],
      fact: "A nutplate is a nut riveted in place. It lets a screw be tightened from one side where no wrench could ever reach the back, such as an inspection cover or a fairing.",
      svg: `<path d="M36 100 a16 16 0 0 1 16 -16 H76 a26 26 0 0 1 48 0 H148 a16 16 0 0 1 0 32 H124 a26 26 0 0 1 -48 0 H52 a16 16 0 0 1 -16 -16 Z" fill="${ST}"/>
        <circle cx="100" cy="100" r="17" fill="${LT}"/><circle cx="100" cy="100" r="9" fill="${DK}"/>${ticks(100, 100, 9, 13, 8, INK, 1.2)}
        <circle cx="52" cy="100" r="5" fill="${BG}"/><circle cx="148" cy="100" r="5" fill="${BG}"/>`,
    },
    {
      id: "an-fitting", name: "Flared tube fitting", kind: "part", zoom: [26, 68, 64],
      decoys: ["Garden hose coupler", "Tire valve stem", "Grease fitting", "Spark plug"],
      fact: "Aircraft \"AN\" fittings seal on a cone flared at 37 degrees; automotive flares are 45 degrees, and the two must never be mixed. Blue means the fitting is aluminum.",
      svg: `<path d="M46 86 L30 93 V107 L46 114 Z" fill="${BL}"/><path d="M154 86 L170 93 V107 L154 114 Z" fill="${BL}"/>
        <rect x="46" y="84" width="36" height="32" fill="#5B93D3"/>${L(54, 84, 51, 116, 5, 6, 0)}<rect x="118" y="84" width="36" height="32" fill="#5B93D3"/>${L(125, 84, 122, 116, 5, 6, 0)}
        <rect x="80" y="74" width="40" height="52" fill="${BL}"/><path d="M80 90 H120 M80 110 H120" ${O}/>`,
    },
    {
      id: "static-wick", name: "Static wick", kind: "part", zoom: [124, 68, 64],
      decoys: ["Pitot tube", "Radio antenna", "Trim tab", "Fuel tank vent"],
      fact: "Flying through rain and dust builds up static electricity on an airplane. Wicks on the trailing edges bleed the charge off quietly into the air, so it does not crackle in the radios.",
      svg: `<path d="M8 66 L92 94 V106 L8 132 Z" fill="${LT}"/><rect x="88" y="92" width="24" height="16" rx="3" fill="${DK}"/><rect x="112" y="96" width="56" height="8" fill="${YL}"/>
        <path d="M168 100 L190 88 M168 100 L192 96 M168 100 L192 104 M168 100 L190 112" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "airspeed", name: "Airspeed indicator", kind: "part", zoom: [64, 104, 72],
      decoys: ["Tachometer", "Altimeter", "Oil pressure gauge", "Fuel gauge"],
      fact: "The colors are a code. The white arc is the range where the flaps may be down, green is normal flying, yellow is for smooth air only, and the red line is the speed never to exceed.",
      svg: `<circle cx="100" cy="100" r="84" fill="${DK}"/><circle cx="100" cy="100" r="74" fill="${RB}"/>${ticks(100, 100, 67, 73, 24, WH, 1.5)}
        ${arc(53, WH, 6, 40, 110)}${arc(62, GN, 7, 60, 140)}${arc(62, YL, 7, 200, 60)}
        <path d="M45.8 109.6 L31.1 112.2" ${O} stroke="${RD}" stroke-width="4"/>${text(100, 66, "KNOTS", 10)}
        <path d="M100 100 L132 130" ${O} stroke="${WH}" stroke-width="4"/><circle cx="100" cy="100" r="7" fill="${ST}"/>`,
    },
    {
      id: "altimeter", name: "Altimeter", kind: "part", zoom: [92, 62, 76],
      decoys: ["Airspeed indicator", "Clock", "Vertical speed indicator", "Tachometer"],
      fact: "The little window shows the barometer setting the pilot dials in. It is called the Kollsman window after Paul Kollsman, whose sensitive altimeter made Jimmy Doolittle's first \"blind\" flight possible in 1929.",
      svg: `<circle cx="34" cy="166" r="12" fill="${DK}"/><circle cx="100" cy="100" r="84" fill="${DK}"/><circle cx="100" cy="100" r="74" fill="${RB}"/>${ticks(100, 100, 68, 73, 50, WH, 1)}
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => { const p = polar(100, 100, 57, n * 36); return text(p[0], p[1] + 5, n, 14); }).join("")}
        <rect x="116" y="93" width="28" height="14" rx="2" fill="${WH}" stroke-width="1.5"/>${text(130, 103.5, "29.92", 8.5, RB)}
        <path d="M100 100 L100 40" ${O} stroke="${WH}" stroke-width="3"/><path d="M100 100 L124 128" ${O} stroke="${WH}" stroke-width="6"/><circle cx="100" cy="100" r="6" fill="${ST}"/>`,
    },
    {
      id: "fuel-sampler", name: "Fuel sampler cup", kind: "gadget", zoom: [64, 84, 72],
      decoys: ["Test tube", "Syringe", "Oil dipstick", "Tire pressure gauge"],
      fact: "Before the first flight of the day a pilot drains a little fuel from each tank into this cup. Aviation gasoline (100LL) is dyed blue, and any water shows up as a clear bubble at the bottom.",
      svg: `<rect x="98" y="18" width="5" height="32" fill="${ST}" stroke-width="1.5"/><rect x="78" y="50" width="44" height="112" rx="4" fill="${WH}"/>
        <path d="M79.5 104 H120.5 V158 a3 3 0 0 1 -3 3 H82.5 a3 3 0 0 1 -3 -3 Z" fill="#8CC3F0" stroke="none"/><path d="M78 104 H122" ${O} stroke-width="1.5"/>
        <rect x="74" y="44" width="52" height="9" rx="2" fill="${DK}"/><path d="M124 60 H133 V122" ${O}/><path d="M78 80 h8 M78 96 h8 M78 120 h8 M78 136 h8 M78 150 h8" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "chocks", name: "Wheel chocks", kind: "gadget", zoom: [24, 86, 64],
      decoys: ["Door stops", "Bucking bars", "Sanding blocks", "Jack stands"],
      fact: "Parking brakes hold with hydraulic pressure that can slowly bleed away, so a parked airplane is chocked as well. The rope lets one hand pull both chocks out at once.",
      svg: `<path d="M14 146 H186" ${O}/><path d="M26 146 L62 92 H76 L94 146 Z" fill="${YL}"/><path d="M106 146 L124 92 H138 L174 146 Z" fill="${YL}"/>
        <path d="M42 146 L68 106 M60 146 L76 122 M158 146 L132 106 M140 146 L124 122" ${O} stroke="${RB}" stroke-width="4"/>
        <path d="M72 100 Q100 136 128 100" ${O} stroke="${WD}" stroke-width="4"/>`,
    },
    {
      id: "calipers", name: "Dial calipers", kind: "tool", zoom: [14, 92, 64],
      decoys: ["Micrometer", "Adjustable wrench", "Tape measure", "C-clamp"],
      fact: "Calipers measure outside, inside and depth to a thousandth of an inch. The sliding scale idea came from Pierre Vernier, a French mathematician, in 1631.",
      svg: `<rect x="20" y="88" width="166" height="14" fill="${LT}"/>${L(112, 88, 112, 94, 9, 8, 0)}
        <path d="M20 88 H36 V150 L20 138 Z" fill="${ST}"/><path d="M36 88 V60 L28 70 V88 Z" fill="${ST}"/>
        <rect x="50" y="82" width="56" height="26" rx="3" fill="${DK}"/><path d="M50 108 H66 V138 L50 150 Z" fill="${ST}"/><path d="M50 82 V60 L58 70 V82 Z" fill="${ST}"/>
        <circle cx="80" cy="95" r="21" fill="${WH}"/>${ticks(80, 95, 16, 20, 20, INK, 1)}<path d="M80 95 L90 82" ${O} stroke="${RD}" stroke-width="2"/><circle cx="80" cy="95" r="2.5" fill="${RB}"/>`,
    },
    {
      id: "micrometer", name: "Micrometer", kind: "tool", zoom: [122, 51, 70],
      decoys: ["Dial calipers", "C-clamp", "Tubing cutter", "Pipe wrench"],
      fact: "The screw inside has 40 threads to the inch, so one full turn of the thimble moves it exactly 25 thousandths. The marks around the thimble split that turn into 25 parts: one thousandth each.",
      svg: `<path d="M30 70 V120 Q30 150 60 150 H100 Q130 150 130 120 V70 H112 V118 Q112 132 100 132 H60 Q48 132 48 118 V70 Z" fill="${DK}"/>
        <rect x="48" y="80" width="12" height="12" fill="${ST}"/><rect x="72" y="80" width="40" height="12" fill="${LT}"/>
        <rect x="130" y="76" width="28" height="20" fill="${LT}"/><path d="M130 86 H158 M136 86 v-5 M142 86 v5 M148 86 v-5 M154 86 v5" ${O} stroke-width="1.2"/>
        <rect x="156" y="72" width="26" height="28" fill="${ST}"/>${L(161, 74, 161, 98, 5, 4.2, 0)}<rect x="182" y="79" width="10" height="14" fill="${DK}"/>`,
    },
    {
      id: "center-punch", name: "Automatic center punch", kind: "tool", zoom: [68, 124, 64],
      decoys: ["Ballpoint pen", "Soldering iron", "Awl", "Tire pressure gauge"],
      fact: "Push down and a spring inside snaps a small hammer against the point, with no mallet needed. The dimple it leaves keeps a drill bit from wandering across the metal.",
      svg: `<rect x="86" y="18" width="28" height="18" rx="6" fill="${DK}"/><rect x="88" y="34" width="24" height="98" rx="4" fill="${ST}"/>
        <rect x="88" y="60" width="24" height="34" fill="${LT}"/>${L(88, 66, 112, 66, 5, 0, 5.6)}
        <path d="M88 132 L96 162 H104 L112 132 Z" fill="${LT}"/><path d="M96 162 L100 184 L104 162 Z" fill="${DK}"/>`,
    },
    {
      id: "locking-pliers", name: "Locking pliers", kind: "tool", zoom: [18, 54, 66],
      decoys: ["Adjustable wrench", "Slip-joint pliers", "Pipe wrench", "Bolt cutters"],
      fact: "The knob at the end sets the jaw opening, and squeezing the handles snaps them locked. A Danish-born blacksmith, William Petersen, invented them in De Witt, Nebraska, in the 1920s.",
      svg: `<path d="M26 72 L58 62 L72 80 L170 86 V100 L72 98 L54 90 L26 90 Z" fill="${ST}"/><path d="M26 98 H52 L68 110 L62 124 L38 118 Z" fill="${ST}"/>
        <path d="M62 114 L158 130 L162 144 L70 134 Z" fill="${LT}"/><path d="M96 100 L112 124" ${O} stroke-width="4"/>
        <rect x="170" y="85" width="18" height="16" rx="2" fill="${DK}"/>${L(175, 87, 175, 99, 3, 4.5, 0)}
        <path d="M28 90 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 M28 98 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "hacksaw", name: "Hacksaw", kind: "tool", zoom: [118, 80, 66],
      decoys: ["Coping saw", "Bow saw", "Bread knife", "Cheese slicer"],
      fact: "A hacksaw blade goes in with the teeth pointing away from the handle, so it cuts on the push stroke. For thin metal, pick a blade fine enough that at least two teeth are always on the work.",
      svg: `<path d="M34 112 V58 H158 V100" ${O} stroke="${BL}" stroke-width="9" stroke-linejoin="miter"/><path d="M148 96 H176 L182 152 H160 Z" fill="${RB}"/>
        <rect x="30" y="108" width="124" height="7" fill="${ST}" stroke-width="1.5"/><path d="M30 115${" l3 4 l3 -4".repeat(20)}" ${O} stroke-width="1.2"/><circle cx="34" cy="111" r="4" fill="${BR}"/>`,
    },
    {
      id: "file", name: "Metal file", kind: "tool", zoom: [110, 67, 66],
      decoys: ["Putty knife", "Wood chisel", "Hacksaw blade", "Butter knife"],
      fact: "Soft aluminum clogs a file's teeth, which machinists call \"pinning\", and the stuck bits scratch the work. A stiff wire brush called a file card cleans them out.",
      svg: `<rect x="24" y="88" width="112" height="24" fill="${ST}"/>${L(28, 88, 40, 112, 9, 11, 0)}${L(40, 88, 28, 112, 9, 11, 0)}
        <path d="M136 94 H150 V106 H136 Z" fill="${ST}"/><rect x="146" y="88" width="9" height="24" fill="${BR}"/><rect x="155" y="84" width="38" height="32" rx="13" fill="${WD}"/>`,
    },
    {
      id: "rivet-puller", name: "Blind rivet puller", kind: "tool", zoom: [18, 16, 66],
      decoys: ["Staple gun", "Caulking gun", "Hole punch", "Glue gun"],
      fact: "A blind rivet is set from one side only: the tool pulls a stem that swells the back of the rivet, then the stem snaps off. Handy where no bucking bar can reach, such as a closed tube.",
      svg: `<path d="M14 51 H32" ${O} stroke-width="2"/><rect x="30" y="47" width="12" height="8" fill="${WH}" stroke-width="1.5"/><path d="M31 42 V60" ${O} stroke-width="4"/>
        <rect x="42" y="44" width="22" height="14" fill="${LT}"/><rect x="62" y="30" width="52" height="40" rx="6" fill="${ST}"/>
        <path d="M72 68 H98 L112 172 H88 Z" fill="${RD}"/><path d="M106 36 L124 32 L164 160 L144 166 Z" fill="${RD}"/><circle cx="104" cy="50" r="5" fill="${DK}"/>`,
    },
    {
      id: "multimeter", name: "Multimeter", kind: "tool", zoom: [66, 112, 68],
      decoys: ["Handheld radio", "Calculator", "Stud finder", "Garage door remote"],
      fact: "A healthy 12-volt airplane battery reads about 12.6 volts at rest. With the engine running and the alternator charging, the same meter should show around 14.",
      svg: `<rect x="58" y="14" width="84" height="172" rx="12" fill="${YL}"/><rect x="70" y="26" width="60" height="32" rx="3" fill="#C9D6C2"/>${text(125, 50, "12.6", 20, RB, "end")}
        ${ticks(100, 106, 31, 36, 12, RB, 2)}<circle cx="100" cy="106" r="27" fill="${RB}"/><path d="M100 106 L100 85" ${O} stroke="${WH}" stroke-width="5"/>
        <circle cx="78" cy="164" r="8" fill="${RD}"/><circle cx="100" cy="164" r="8" fill="${RB}"/><circle cx="122" cy="164" r="8" fill="${RB}"/>
        <circle cx="78" cy="164" r="3" fill="${DK}" stroke="none"/><circle cx="100" cy="164" r="3" fill="${DK}" stroke="none"/><circle cx="122" cy="164" r="3" fill="${DK}" stroke="none"/>`,
    },
    {
      id: "circuit-breaker", name: "Circuit breaker", kind: "part", zoom: [66, 14, 68],
      decoys: ["Toggle switch", "Fuse holder", "Push-to-talk button", "Starter button"],
      fact: "The number on the button is its rating in amps. A breaker is sized to protect the wire, not the radio or light at the end of it. When it trips, the button pops out and shows a white band.",
      svg: `<rect x="60" y="96" width="80" height="62" rx="4" fill="${RB}"/><rect x="68" y="158" width="16" height="18" fill="${BR}"/><rect x="116" y="158" width="16" height="18" fill="${BR}"/>
        <rect x="84" y="66" width="32" height="30" fill="${ST}"/><rect x="74" y="78" width="52" height="12" fill="${LT}"/>
        <rect x="88" y="50" width="24" height="18" fill="${WH}"/><rect x="84" y="22" width="32" height="32" rx="4" fill="${RB}"/>${text(100, 45, "5", 20)}`,
    },
    {
      id: "drill-bit", name: "Twist drill bit", kind: "tool", zoom: [68, 124, 64],
      decoys: ["Thread tap", "Wood screw", "End mill", "Corkscrew"],
      fact: "Airplane builders use numbered drill sizes. A number 40 bit makes the hole for a 3/32 inch rivet and a number 30 bit for a 1/8 inch rivet, each a few thousandths oversize so the rivet slips in.",
      svg: `<rect x="90" y="12" width="20" height="50" fill="${ST}"/><rect x="90" y="62" width="20" height="104" fill="${LT}"/>${L(90, 84, 110, 66, 5, 0, 20, 2)}
        <path d="M90 166 L100 184 L110 166 Z" fill="${DK}"/>`,
    },
    {
      id: "position-light", name: "Wingtip position light", kind: "part", zoom: [116, 62, 66],
      decoys: ["Landing light", "Rotating beacon", "Taxi light", "Cabin dome light"],
      fact: "Red is on the left wingtip and green on the right, the same as on ships. At night, the colors another pilot can see tell which way your airplane is heading.",
      svg: `<path d="M8 62 L116 70 Q168 78 184 108 Q172 132 118 134 L8 142 Z" fill="${WH}"/><path d="M60 66 V138" ${O} stroke-width="1.2"/>
        <path d="M118 71 Q168 78 184 108 Q176 124 160 130 Q150 96 118 71 Z" fill="${RD}"/><circle cx="158" cy="100" r="6" fill="${WH}" opacity=".85"/>`,
    },
    {
      id: "cylinder", name: "Engine cylinder", kind: "part", zoom: [40, 84, 64],
      decoys: ["Radiator", "Oil cooler", "Air filter", "Baseboard heater"],
      fact: "Most small airplane engines are cooled by air, not water. The thin fins give the hot cylinder far more surface, and sheet-metal baffles under the cowl force the air down through them.",
      svg: `<rect x="74" y="14" width="20" height="12" fill="${DK}"/><rect x="106" y="14" width="20" height="12" fill="${DK}"/><rect x="62" y="24" width="76" height="46" rx="6" fill="${ST}"/>
        <rect x="64" y="70" width="72" height="102" fill="${DK}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="48" y="${76 + i * 12}" width="104" height="6" rx="2" fill="${LT}" stroke-width="1.5"/>`).join("")}
        <rect x="56" y="172" width="88" height="12" fill="${ST}"/>`,
    },
    {
      id: "oil-filter", name: "Oil filter", kind: "part", zoom: [70, 10, 66],
      decoys: ["Spray paint can", "Fuel pump", "Vacuum pump", "Fire extinguisher"],
      fact: "At every oil change the mechanic cuts the old filter open and unfolds the paper inside to look for bits of metal, an early warning that something in the engine is wearing.",
      svg: `<rect x="88" y="20" width="24" height="18" fill="${ST}"/><rect x="60" y="36" width="80" height="126" rx="10" fill="${WH}"/>
        <rect x="61.5" y="80" width="77" height="36" fill="${RD}" stroke="none"/><path d="M60 80 H140 M60 116 H140" ${O}/><rect x="54" y="160" width="92" height="14" rx="3" fill="${DK}"/>
        <circle cx="106" cy="29" r="2" fill="${RB}" stroke="none"/><path d="M106 29 Q150 30 160 62" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "tape-measure", name: "Tape measure", kind: "tool", zoom: [124, 104, 70],
      decoys: ["Chalk line", "Dog leash", "Feeler gauge", "Carpenter's level"],
      fact: "The hook on the end is loose on purpose. It slides by exactly its own thickness, so the tape reads true whether you hook it over an edge or push it against a wall.",
      svg: `<rect x="134" y="130" width="54" height="13" fill="#F3E27A"/>${L(142, 130, 142, 136, 6, 8, 0)}<rect x="186" y="126" width="5" height="26" fill="${ST}" stroke-width="1.5"/>
        <rect x="30" y="46" width="108" height="108" rx="20" fill="${YL}"/><circle cx="84" cy="100" r="26" fill="${DK}"/><circle cx="84" cy="100" r="8" fill="${ST}"/><rect x="112" y="58" width="18" height="10" rx="3" fill="${RB}"/>`,
    },
    {
      id: "windsock", name: "Windsock", kind: "gadget", zoom: [70, 16, 64],
      decoys: ["Traffic cone", "Kite", "Signal flag", "Parachute"],
      fact: "A standard airport windsock stands straight out in a wind of about 15 knots. If it droops halfway, the wind is roughly half that.",
      svg: `<path d="M40 192 V30" ${O} stroke="${DK}" stroke-width="6"/><path d="M44 26 L176 46 V64 L44 68 Z" fill="${OR}"/>
        <path d="M77 31 L110 36 V66 L77 67 Z" fill="${WH}"/><path d="M143 41 L176 46 V64 L143 65 Z" fill="${WH}"/><ellipse cx="44" cy="47" rx="5" ry="21" fill="${BG}"/>`,
    },
    {
      id: "headset", name: "Aviation headset", kind: "gadget", zoom: [70, 136, 60],
      decoys: ["Stereo headphones", "Hearing protectors", "Stethoscope", "Bicycle helmet"],
      fact: "A small piston airplane's cabin is loud enough to harm hearing over time. The pale green ear cups of the David Clark headset have been a familiar sight in cockpits since the 1970s.",
      svg: `<path d="M48 108 A52 58 0 0 1 152 108" ${O} stroke="${RB}" stroke-width="10"/><rect x="32" y="98" width="32" height="58" rx="13" fill="${GN}"/><rect x="136" y="98" width="32" height="58" rx="13" fill="${GN}"/>
        <rect x="60" y="106" width="8" height="42" rx="4" fill="${RB}"/><rect x="132" y="106" width="8" height="42" rx="4" fill="${RB}"/>
        <path d="M46 156 Q52 186 92 182" ${O} stroke-width="4"/><rect x="90" y="174" width="24" height="15" rx="7" fill="${RB}"/>`,
    },
    {
      id: "adel-clamp", name: "Cushioned clamp", kind: "part", zoom: [64, 100, 66],
      decoys: ["Hose clamp", "Key ring", "Shower curtain ring", "Pipe hanger"],
      fact: "Mechanics call it an Adel clamp, after the company that first made them. The rubber cushion keeps wires and tubes from chafing as the engine shakes them thousands of times a minute.",
      svg: `<rect x="86" y="120" width="28" height="54" rx="4" fill="${ST}"/><circle cx="100" cy="154" r="7" fill="${BG}"/>
        <circle cx="100" cy="84" r="40" fill="${ST}"/><circle cx="100" cy="84" r="33" fill="${RB}"/><circle cx="100" cy="84" r="25" fill="${BG}"/>
        <circle cx="91" cy="78" r="8" fill="${WH}"/><circle cx="108" cy="78" r="8" fill="${RD}"/><circle cx="100" cy="93" r="8" fill="${BL}"/>`,
    },
    {
      id: "zip-tie", name: "Zip tie", kind: "gadget", zoom: [80, 108, 62],
      decoys: ["Hose clamp", "Rubber band", "Twist tie", "Safety wire"],
      fact: "The zip tie was invented for airplanes. Maurus Logan of Thomas & Betts came up with it in 1958 after watching workers lace aircraft wire bundles by hand with waxed cord.",
      svg: `<circle cx="100" cy="92" r="42" ${O} stroke="${RB}" stroke-width="9"/><path d="M112 136 L184 150" ${O} stroke="${RB}" stroke-width="9"/>${L(131, 136, 129, 145, 6, 9, 1.75, 1.2, ST)}
        <rect x="88" y="124" width="26" height="22" rx="3" fill="${DK}"/>`,
    },
    {
      id: "ball-peen", name: "Ball peen hammer", kind: "tool", zoom: [104, 18, 66],
      decoys: ["Claw hammer", "Rubber mallet", "Sledgehammer", "Meat tenderizer"],
      fact: "The rounded end, the peen, was made for metalwork: rounding over rivet tails and shaping sheet metal. A carpenter's hammer has a claw there instead.",
      svg: `<rect x="93" y="64" width="14" height="126" rx="6" fill="${WD}"/><rect x="56" y="34" width="58" height="34" rx="4" fill="${ST}"/><rect x="48" y="30" width="12" height="42" rx="3" fill="${LT}"/>
        <rect x="114" y="42" width="14" height="18" fill="${ST}"/><circle cx="142" cy="51" r="17" fill="${ST}"/>`,
    },
    {
      id: "wrench", name: "Combination wrench", kind: "tool", zoom: [8, 68, 64],
      decoys: ["Adjustable wrench", "Bottle opener", "Pipe wrench", "Tuning fork"],
      fact: "Two sizes cover a surprising share of a small airplane. The AN3 bolt takes a 3/8 inch wrench and the AN4 bolt takes a 7/16.",
      svg: `<rect x="48" y="92" width="98" height="16" fill="${ST}"/><circle cx="160" cy="100" r="21" fill="${ST}"/><circle cx="160" cy="100" r="11" fill="${BG}"/>
        <path d="M50 92 L44 80 L26 74 L12 84 L24 90 L30 100 L24 110 L12 116 L26 126 L44 120 L50 108 Z" fill="${ST}"/>`,
    },
    {
      id: "compass", name: "Magnetic compass", kind: "part", zoom: [58, 54, 62],
      decoys: ["Clock", "Outside air thermometer", "G-meter", "Fuel gauge"],
      fact: "Pilots call it the whiskey compass, because the card floats in liquid that was once alcohol. The numbers leave off the last zero, so 33 means 330 degrees.",
      svg: `<rect x="86" y="24" width="28" height="22" fill="${DK}"/><rect x="44" y="44" width="112" height="100" rx="18" fill="${RB}"/><rect x="58" y="60" width="84" height="46" rx="8" fill="#16323F"/>
        ${text(72, 98, "3", 18)}${text(100, 98, "N", 18)}${text(128, 98, "33", 18)}<path d="M86 66 v8 M114 66 v8" ${O} stroke="${WH}" stroke-width="1.5"/><path d="M100 60 V76" ${O} stroke="${YL}" stroke-width="2.5"/>
        <circle cx="80" cy="126" r="6" fill="${BR}"/><circle cx="120" cy="126" r="6" fill="${BR}"/>`,
    },
    {
      id: "gascolator", name: "Gascolator", kind: "part", zoom: [64, 106, 72],
      decoys: ["Mason jar", "Oil filter", "Vacuum pump", "Brake fluid reservoir"],
      fact: "The gascolator is a fuel strainer mounted at the lowest point in the fuel system. Water is heavier than gasoline, so it settles in the bowl, where the pilot can drain it before flight.",
      svg: `<rect x="36" y="46" width="26" height="14" fill="${BL}"/><rect x="138" y="46" width="26" height="14" fill="${BL}"/><rect x="58" y="36" width="84" height="30" rx="5" fill="${DK}"/>
        <path d="M68 66 H132 V122 Q132 150 100 150 Q68 150 68 122 Z" fill="${LT}"/><path d="M62 62 V140 Q100 176 138 140 V62" ${O} stroke-width="2.5"/>
        <rect x="96" y="166" width="8" height="14" fill="${ST}"/><circle cx="100" cy="160" r="8" fill="${BR}"/>`,
    },
    {
      id: "piano-hinge", name: "Piano hinge", kind: "part", zoom: [124, 66, 66],
      decoys: ["Zipper", "Bicycle chain", "Terminal strip", "Gear rack"],
      fact: "Many kit airplanes hold the engine cowl on with long piano hinges. Pull the pin out and the cowl lifts away with no screws showing.",
      svg: `<rect x="24" y="50" width="140" height="44" fill="${LT}"/><rect x="24" y="106" width="140" height="44" fill="${ST}"/>
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${24 + i * 20}" y="90" width="20" height="20" rx="4" fill="${i % 2 ? ST : LT}"/>`).join("")}
        ${[44, 94, 144].map((x) => `<circle cx="${x}" cy="66" r="4" fill="${BG}"/><circle cx="${x}" cy="134" r="4" fill="${BG}"/>`).join("")}
        <path d="M164 100 H184 V82" ${O}/>`,
    },
    {
      id: "stick-grip", name: "Control stick grip", kind: "part", zoom: [66, 28, 66],
      decoys: ["Throttle lever", "Cordless drill handle", "Bicycle grip", "Flashlight"],
      fact: "The little four-way \"hat\" switch on top usually runs the electric trim, so the pilot can take the pressure off the stick without letting go. Other buttons key the radio or disconnect the autopilot.",
      svg: `<rect x="90" y="170" width="20" height="22" fill="${ST}"/><path d="M82 104 Q64 108 70 128 L84 124 Z" fill="${DK}"/>
        <path d="M84 174 L80 92 Q76 44 100 34 Q128 40 124 84 L118 174 Z" fill="${RB}"/><circle cx="98" cy="58" r="10" fill="${LT}"/><circle cx="98" cy="58" r="4" fill="${DK}"/>
        <circle cx="114" cy="84" r="6" fill="${RD}"/><path d="M88 132 H114 M88 146 H114 M88 160 H114" ${O} stroke="${DK}" stroke-width="2"/>`,
    },
    {
      id: "wheel-pant", name: "Wheel pant", kind: "part", zoom: [56, 94, 68],
      decoys: ["Engine cowl", "Wingtip", "Propeller spinner", "Canoe"],
      fact: "A bare wheel hanging in the wind makes a lot of drag. Streamlined wheel pants and leg fairings can be worth several knots of cruise speed on a fixed-gear airplane.",
      svg: `<path d="M14 158 H186" ${O} stroke-width="2"/><path d="M98 64 L112 14" ${O} stroke="${ST}" stroke-width="9"/><circle cx="92" cy="127" r="30" fill="${RB}"/><circle cx="92" cy="127" r="10" fill="${ST}"/>
        <path d="M16 104 Q40 62 100 62 Q160 64 188 106 Q150 132 100 134 Q40 134 16 104 Z" fill="${WH}"/><path d="M26 98 Q100 82 178 100" ${O} stroke="${RD}" stroke-width="5"/>`,
    },
    {
      id: "feeler-gauge", name: "Feeler gauge", kind: "tool", zoom: [66, 22, 68],
      decoys: ["Pocket knife", "Allen key set", "Folding ruler", "Paint color samples"],
      fact: "Each blade is ground to an exact thickness. One job is setting spark plug gaps, around 16 to 19 thousandths of an inch on many airplane plugs, about the thickness of four sheets of paper.",
      svg: `${[-44, -22, 0, 22, 44].map((a) => `<rect x="92" y="34" width="16" height="120" rx="8" fill="${a % 44 ? ST : LT}" transform="rotate(${a} 100 150)"/>`).join("")}
        <rect x="84" y="128" width="32" height="58" rx="8" fill="${DK}"/><circle cx="100" cy="150" r="6" fill="${BR}"/>`,
    },
    {
      id: "deburring-tool", name: "Deburring tool", kind: "tool", zoom: [72, 4, 60],
      decoys: ["Seam ripper", "Crochet hook", "Dental pick", "Awl"],
      fact: "Drilling leaves a tiny sharp ridge, a burr, around every hole. The hooked blade swivels to shave it off, because a burr can hold two skins apart and give a crack a place to start.",
      svg: `<path d="M100 44 V30 Q100 14 118 12" ${O} stroke="${DK}" stroke-width="5"/><rect x="95" y="42" width="10" height="32" fill="${ST}"/>
        <rect x="84" y="72" width="32" height="112" rx="12" fill="${BL}"/><path d="M92 90 V166 M100 90 V166 M108 90 V166" ${O} stroke-width="1.5"/>`,
    },
    {
      id: "engine-knobs", name: "Throttle, prop and mixture knobs", kind: "part", zoom: [112, 22, 70],
      decoys: ["Cabin heat and vent knobs", "Radio volume knobs", "Stove burner knobs", "Organ stops"],
      fact: "The shapes and colors are standard so a pilot can tell them apart by feel: a smooth black knob for throttle, a blue scalloped one for the propeller, and a red spiky one for mixture.",
      svg: `${[50, 100, 150].map((c) => `<rect x="${c - 4}" y="66" width="8" height="54" fill="${ST}"/>`).join("")}<rect x="12" y="120" width="176" height="60" fill="${DK}"/>
        ${[50, 100, 150].map((c) => `<rect x="${c - 13}" y="112" width="26" height="10" fill="${LT}"/>`).join("")}
        <circle cx="50" cy="52" r="25" fill="${RB}"/>${[0, 60, 120, 180, 240, 300].map((a) => { const p = polar(100, 52, 20, a); return `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="${BL}"/>`; }).join("")}
        <circle cx="100" cy="52" r="20" fill="${BL}" stroke="none"/><polygon points="${star(150, 52, 27, 18, 8)}" fill="${RD}"/>`,
    },
    {
      id: "mag-switch", name: "Magneto switch", kind: "part", zoom: [92, 22, 78],
      decoys: ["Fuel selector valve", "Cabin light dimmer", "Radio channel selector", "Combination lock"],
      fact: "R and L pick one magneto at a time. Before takeoff the pilot switches to each in turn and watches for a small, even drop in engine speed, proof that both ignition systems are working.",
      svg: `<circle cx="100" cy="100" r="80" fill="${DK}"/>${[["OFF", -62], ["R", -22], ["L", 10], ["BOTH", 44], ["START", 82]].map(([s, a]) => { const p = polar(100, 100, 56, a); return text(p[0], p[1] + 4, s, 11); }).join("")}
        <circle cx="100" cy="100" r="30" fill="${ST}"/><g transform="rotate(44 100 100)"><rect x="92" y="62" width="16" height="60" rx="5" fill="${LT}"/><circle cx="100" cy="74" r="3" fill="${DK}"/></g>`,
    },
    {
      id: "attitude", name: "Attitude indicator", kind: "part", zoom: [64, 64, 72],
      decoys: ["Turn coordinator", "Magnetic compass", "Carpenter's level", "Altimeter"],
      fact: "Blue is sky and brown is ground. Inside clouds, with no real horizon to see, this little artificial one is how a pilot tells which way is up.",
      svg: `<circle cx="100" cy="100" r="84" fill="${DK}"/><path d="M30 100 A70 70 0 0 1 170 100 Z" fill="#4E9BD8"/><path d="M30 100 A70 70 0 0 0 170 100 Z" fill="#8A5A33"/>
        <path d="M30 100 H170" ${O} stroke="${WH}" stroke-width="2"/><path d="M88 80 H112 M93 90 H107 M93 110 H107 M88 120 H112" ${O} stroke="${WH}" stroke-width="2"/>
        <path d="M100 34 L94 46 H106 Z" fill="${WH}"/><path d="M60 100 H88 L100 111 L112 100 H140" ${O} stroke="${YL}" stroke-width="5"/><circle cx="100" cy="100" r="3" fill="${YL}"/>`,
    },
  ];
  const BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const KINDS = { part: "an airplane part", tool: "a shop tool", gadget: "a shop or ramp gadget" };

  // The picture. With close-up = true only the zoom window shows; otherwise the whole drawing.
  const viewBox = (item, closeUp) => (closeUp ? [item.zoom[0], item.zoom[1], item.zoom[2], item.zoom[2]] : [0, 0, 200, 200]);
  function svg(item, closeUp, label) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(item, closeUp).join(" ")}" role="img" aria-label="${label || "Mystery picture"}">` +
      `<rect x="-50" y="-50" width="300" height="300" fill="${BG}"/><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${item.svg}</g></svg>`;
  }

  // ---------- which riddle on which day ----------
  // Day number: whole days since January 1, 2026, by the phone's own calendar.
  const dayNumber = (date) => Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
  const dateOfDay = (day) => new Date(2026, 0, 1 + day);
  // Every riddle comes up once before any repeats; each pass through the list is in a new order.
  function orderFor(cycle) {
    const o = makeRng(0x52494221 + cycle * 7919).shuffle(ITEMS.map((_, i) => i));
    const prev = makeRng(0x52494221 + (cycle - 1) * 7919).shuffle(ITEMS.map((_, i) => i));
    if (o[0] === prev[prev.length - 1]) [o[0], o[1]] = [o[1], o[0]]; // never the same riddle two days running
    return o;
  }
  function dailyItem(day) {
    const n = ITEMS.length, cycle = Math.floor(day / n);
    return ITEMS[orderFor(cycle)[day - cycle * n]];
  }
  // Four choices in a mixed order: the answer and three wrong ones.
  function choicesFor(item, seed) {
    let h = Math.imul((seed >>> 0) + 1, 2654435761); // stir the seed so neighboring days don't mix alike
    for (const ch of item.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const R = makeRng(h);
    for (let i = 0; i < 4; i++) R.next();
    return R.shuffle([item.name, ...R.shuffle(item.decoys).slice(0, 3)]);
  }
  // A practice riddle: one not yet seen if there is one, never one of the ids to avoid.
  function practiceItem(seen, avoid, R) {
    const ok = ITEMS.filter((it) => !avoid.includes(it.id));
    const fresh = ok.filter((it) => !seen[it.id]);
    return (R || makeRng()).pick(fresh.length ? fresh : ok);
  }

  // ---------- streaks ----------
  // A streak is days in a row with the daily riddle answered right. A wrong answer or a missed day ends it.
  const NEW_STATS = { last: null, now: 0, best: 0, played: 0, right: 0 };
  function recordDay(stats, day, correct) {
    const s = Object.assign({}, NEW_STATS, stats);
    if (s.last === day) return s; // one answer a day
    s.now = correct ? (s.last === day - 1 ? s.now + 1 : 1) : 0;
    s.best = Math.max(s.best, s.now);
    s.played += 1; s.right += correct ? 1 : 0; s.last = day;
    return s;
  }
  const liveStreak = (stats, today) => (stats && stats.last !== null && stats.last >= today - 1 ? stats.now : 0);

  const api = { ITEMS, BY_ID, KINDS, BG, makeRng, svg, viewBox, dayNumber, dateOfDay, dailyItem, choicesFor, practiceItem, recordDay, liveStreak, NEW_STATS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WRR = api;
})(typeof self !== "undefined" ? self : this);
