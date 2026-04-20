// Champion roster. Static bios + stats (0..100) + traits/flaws + loyalty (0..100).
// Higher is better for every stat except criminal_energy and excess, which are
// dual-use: high presence/charm comes with discipline costs.

const CHARACTERS = [
  {
    id: "volkov",
    name: "Ivan Volkov",
    age: 52,
    role: "veteran",
    stats: {
      opening: 88,
      middlegame: 70,
      endgame: 72,
      condition: 35,
      presence: 80,
      dexterity: 45,
      nerves: 78,
      criminal_energy: 40,
      excess: 60,
    },
    traits: ["soviet_school", "match_hardened"],
    flaws: ["alcoholic"],
    loyalty: 55,
  },
  {
    id: "petrov",
    name: "Mikhail Petrov",
    age: 16,
    role: "prodigy",
    stats: {
      opening: 72,
      middlegame: 92,
      endgame: 68,
      condition: 80,
      presence: 30,
      dexterity: 85,
      nerves: 28,
      criminal_energy: 15,
      excess: 20,
    },
    traits: ["tactical_genius", "fast_learner"],
    flaws: ["socially_anxious"],
    loyalty: 70,
  },
  {
    id: "kozlov",
    name: "Dmitri Kozlov",
    age: 32,
    role: "lebemann",
    stats: {
      opening: 65,
      middlegame: 65,
      endgame: 65,
      condition: 55,
      presence: 90,
      dexterity: 60,
      nerves: 55,
      criminal_energy: 70,
      excess: 85,
    },
    traits: ["media_magnet", "charmer"],
    flaws: ["gambling_addict"],
    loyalty: 40,
  },
];

export function getAllCharacters() {
  return CHARACTERS;
}

export function getCharacterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
