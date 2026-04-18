// Namen, Klubs, initiale Daten fuer die Liga-Generierung.

export const FIRST_NAMES = [
  "Magnus","Viktor","Nikolai","Dmitri","Aron","Levon","Hikaru","Ding","Ian","Fabio",
  "Wesley","Anish","Sergey","Alireza","Firouzja","Shakhriyar","Richard","Gukesh",
  "Praggnan","Vidit","Arjun","Teimour","Wei","Ju","Hou","Alexandra","Tan","Humpy",
  "Mariya","Nana","Kateryna","Anna","Yifan","Irina","Valentina","Elisabeth","Judit",
  "Pia","Dina","Jorden","Max","Benjamin","Yannick","Karl","Jonas","Finn","Lukas",
  "Emil","Oskar","Matteo","Enrico","Diego","Pedro","Joao","Mateo","Santiago",
  "Luca","Elias","Noah","Leo","Ben","Felix","Anton","David","Mikael","Henrik",
  "Mattis","Gustav","Nils","Soren","Bjoern","Arnd","Jesper","Espen","Rasmus","Kai",
  "Yusuf","Omar","Ibrahim","Karim","Amir","Tarek","Mahmoud","Noor","Rami","Samir"
];

export const LAST_NAMES = [
  "Carlsen","Caruana","Nakamura","Liren","Nepomniachtchi","So","Giri","Karjakin",
  "Firouzja","Mamedyarov","Rapport","Dommaraju","Praggnanandhaa","Erigaisi","Vidit",
  "Radjabov","Yi","Wenjun","Yifan","Muzychuk","Kosteniuk","Goryachkina","Polgar",
  "Koneru","Paehtz","Krush","Cramling","Hou","Hansen","Andersen","Bjornsson",
  "Johansson","Nyholm","Lindgren","Ekstrom","Berglund","Holm","Petrov","Ivanov",
  "Sokolov","Volkov","Morozov","Zaitsev","Vasiliev","Kuznetsov","Smirnov","Popov",
  "Müller","Schmidt","Fischer","Weber","Meyer","Wagner","Becker","Hoffmann","Schulz",
  "Lindqvist","Carbajal","Rossi","Bianchi","Conti","Esposito","Ferrari","Ricci",
  "Torres","Ramirez","Navarro","Molina","Vargas","Gomez","Silva","Pereira","Santos",
  "Nakashima","Tanaka","Yamada","Kim","Park","Choi","Lee","Cheng","Wang","Zhang",
  "Abdullah","Haddad","Nassar","Youssef","Tekin","Demir","Özdemir"
];

// Land + Stadt-Elemente fuer Vereinsnamen
const CITIES = [
  "Copenhagen","Reykjavik","Oslo","Helsinki","Stockholm","Tallinn","Riga","Vilnius",
  "Warsaw","Prague","Berlin","Hamburg","Munich","Leipzig","Vienna","Zurich","Basel",
  "Geneva","Paris","Lyon","Marseille","Milan","Torino","Rome","Naples","Madrid",
  "Barcelona","Seville","Lisbon","Porto","London","Manchester","Edinburgh","Dublin",
  "Amsterdam","Rotterdam","Brussels","Luxembourg","Budapest","Belgrade","Zagreb",
  "Sofia","Bucharest","Athens","Istanbul","Ankara","Moscow","St.Petersburg","Kiev",
  "Minsk","Yerevan","Tbilisi","Baku","Tashkent","Almaty","Delhi","Chennai","Mumbai",
  "Beijing","Shanghai","Seoul","Tokyo","Osaka","Singapore","Bangkok","Manila",
  "Sydney","Melbourne","NewYork","Chicago","Toronto","Havana","MexicoCity","Bogota",
  "Lima","Santiago","BuenosAires","SaoPaulo","RioDeJaneiro","Cairo","Casablanca",
  "Tunis","Accra","Lagos","Nairobi","CapeTown"
];

const SUFFIXES = [
  "Kings","Knights","Rooks","Bishops","Pawns","Queens","Castle","Gambit",
  "Sicilian","Zugzwang","Endgame","Blitz","Rapid","Classical","Fianchetto",
  "Zwischenzug","Tempo","Tactics","Opening","Defense","Attack","Tower",
  "Masters","Grand","Royals","Check","Minor","Major","Fork","Pin",
  "Skewer","Discovery","Promotion","Swindlers","Fortress","Pilgrims"
];

export function randName(rng) {
  return FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
    + " " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
}

export function randClubName(rng, used) {
  for (let i = 0; i < 300; i++) {
    const c = CITIES[Math.floor(rng() * CITIES.length)];
    const s = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
    const n = `${c} ${s}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  // Fallback mit Index
  const c = CITIES[Math.floor(rng() * CITIES.length)];
  const n = `${c} FC ${Math.floor(rng()*999)}`; used.add(n); return n;
}

// Seeded RNG (mulberry32)
export function makeRng(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Gauss-like mit Clamp (rating generator)
export function gauss(rng, mean, sd) {
  const u = 1 - rng(), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const LEAGUES = [
  { id: 0, name: "Königsliga", ratingMean: 2500, ratingSd: 140, prize: 5000000 },
  { id: 1, name: "Großmeister-Liga", ratingMean: 2200, ratingSd: 140, prize: 1200000 },
  { id: 2, name: "Meister-Liga", ratingMean: 1900, ratingSd: 150, prize: 300000 },
  { id: 3, name: "Amateur-Liga", ratingMean: 1500, ratingSd: 170, prize: 60000 },
];

export const BOARDS_PER_TEAM = 5;
export const TEAMS_PER_LEAGUE = 8;         // 8 Teams, jeder gegen jeden zweimal = 14 Runden
export const SEASON_ROUNDS = (TEAMS_PER_LEAGUE - 1) * 2;
