/**
 * Filmphile — static data layer.
 *
 * Ported 1:1 from the React/TypeScript version (legacy-react/src).
 *
 * Genre ids come from the original C program's global ints:
 *   int scify = 0; int actionfilm = 1; int thriller = 2; int drama = 3;
 *   int crime = 4; int biography = 5; int horror = 6;   // 7 was skipped
 *   int adventure = 8; int superhero = 9; int comedy = 10;
 * The missing 7 is filled with Romance and 11 (Animation) is new.
 */
(function (global) {
  'use strict';

  var CATEGORIES = [
    { id: 0, key: 'scify', label: 'Sci-Fi' },
    { id: 1, key: 'actionfilm', label: 'Action' },
    { id: 2, key: 'thriller', label: 'Thriller' },
    { id: 3, key: 'drama', label: 'Drama' },
    { id: 4, key: 'crime', label: 'Crime' },
    { id: 5, key: 'biography', label: 'Biography' },
    { id: 6, key: 'horror', label: 'Horror' },
    { id: 7, key: 'romance', label: 'Romance' },
    { id: 8, key: 'adventure', label: 'Adventure' },
    { id: 9, key: 'superhero', label: 'Superhero' },
    { id: 10, key: 'comedy', label: 'Comedy' },
    { id: 11, key: 'animation', label: 'Animation' }
  ];

  var LANGUAGES = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'Hindi' },
    { id: 'kn', label: 'Kannada' },
    { id: 'ko', label: 'Korean' },
    { id: 'ja', label: 'Japanese' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' }
  ];

  var LANGUAGE_MAP = {};
  LANGUAGES.forEach(function (l) { LANGUAGE_MAP[l.id] = l; });

  function getLanguage(id) {
    return LANGUAGE_MAP[id] || { id: id, label: id };
  }

  var FALLBACK_CATEGORY = { id: -1, key: 'unknown', label: 'Unknown' };

  var CATEGORY_MAP = {};
  CATEGORIES.forEach(function (c) {
    CATEGORY_MAP[c.id] = c;
  });

  function getCategory(id) {
    return CATEGORY_MAP[id] || FALLBACK_CATEGORY;
  }

  /** `struct movie { char moviename[30]; int category; };` */
  var MOVIES = [
    { id: 0, moviename: 'Avengers', category: 9, year: 2012, language: 'en' },
    { id: 1, moviename: 'Inception', category: 0, year: 2010, language: 'en' },
    { id: 2, moviename: 'Oppenheimer', category: 5, year: 2023, language: 'en' },
    { id: 3, moviename: 'Interstellar', category: 0, year: 2014, language: 'en' },
    { id: 4, moviename: 'KGF', category: 1, year: 2018, language: 'kn' },
    { id: 5, moviename: 'Batman', category: 9, year: 2008, language: 'en' },
    { id: 6, moviename: 'Avengers: Endgame', category: 9, year: 2019, language: 'en' },
    { id: 7, moviename: 'The Dark Knight', category: 2, year: 2008, language: 'en' },
    { id: 8, moviename: 'Shawshank Redemption', category: 3, year: 1994, language: 'en' },
    { id: 9, moviename: 'The Godfather', category: 4, year: 1972, language: 'en' },

    // --- Sci-Fi (0) ---
    { id: 10, moviename: 'The Matrix', category: 0, year: 1999, language: 'en' },
    { id: 11, moviename: 'Arrival', category: 0, year: 2016, language: 'en' },
    { id: 12, moviename: 'Blade Runner 2049', category: 0, year: 2017, language: 'en' },
    { id: 13, moviename: 'Dune', category: 0, year: 2021, language: 'en' },

    // --- Action (1) ---
    { id: 14, moviename: 'Mad Max: Fury Road', category: 1, year: 2015, language: 'en' },
    { id: 15, moviename: 'John Wick', category: 1, year: 2014, language: 'en' },
    { id: 16, moviename: 'Die Hard', category: 1, year: 1988, language: 'en' },
    { id: 17, moviename: 'Gladiator', category: 1, year: 2000, language: 'en' },

    // --- Thriller (2) ---
    { id: 18, moviename: 'Se7en', category: 2, year: 1995, language: 'en' },
    { id: 19, moviename: 'Zodiac', category: 2, year: 2007, language: 'en' },
    { id: 20, moviename: 'Gone Girl', category: 2, year: 2014, language: 'en' },
    { id: 21, moviename: 'Shutter Island', category: 2, year: 2010, language: 'en' },

    // --- Drama (3) ---
    { id: 22, moviename: 'Forrest Gump', category: 3, year: 1994, language: 'en' },
    { id: 23, moviename: 'Parasite', category: 3, year: 2019, language: 'ko' },
    { id: 24, moviename: 'Whiplash', category: 3, year: 2014, language: 'en' },
    { id: 25, moviename: 'The Green Mile', category: 3, year: 1999, language: 'en' },

    // --- Crime (4) ---
    { id: 26, moviename: 'Goodfellas', category: 4, year: 1990, language: 'en' },
    { id: 27, moviename: 'Pulp Fiction', category: 4, year: 1994, language: 'en' },
    { id: 28, moviename: 'Heat', category: 4, year: 1995, language: 'en' },
    { id: 29, moviename: 'Scarface', category: 4, year: 1983, language: 'en' },

    // --- Biography (5) ---
    { id: 30, moviename: 'The Wolf of Wall Street', category: 5, year: 2013, language: 'en' },
    { id: 31, moviename: 'Catch Me If You Can', category: 5, year: 2002, language: 'en' },
    { id: 32, moviename: 'The Social Network', category: 5, year: 2010, language: 'en' },
    { id: 33, moviename: 'A Beautiful Mind', category: 5, year: 2001, language: 'en' },

    // --- Horror (6) ---
    { id: 34, moviename: 'Hereditary', category: 6, year: 2018, language: 'en' },
    { id: 35, moviename: 'The Conjuring', category: 6, year: 2013, language: 'en' },
    { id: 36, moviename: 'Get Out', category: 6, year: 2017, language: 'en' },
    { id: 37, moviename: 'The Shining', category: 6, year: 1980, language: 'en' },

    // --- Romance (7) ---
    { id: 38, moviename: 'La La Land', category: 7, year: 2016, language: 'en' },
    { id: 39, moviename: 'The Notebook', category: 7, year: 2004, language: 'en' },
    { id: 40, moviename: 'Before Sunrise', category: 7, year: 1995, language: 'en' },

    // --- Adventure (8) ---
    { id: 41, moviename: 'Raiders of the Lost Ark', category: 8, year: 1981, language: 'en' },
    { id: 42, moviename: 'Jurassic Park', category: 8, year: 1993, language: 'en' },
    { id: 43, moviename: 'The Lord of the Rings: The Fellowship of the Ring', category: 8, year: 2001, language: 'en' },
    { id: 44, moviename: 'Life of Pi', category: 8, year: 2012, language: 'en' },

    // --- Superhero (9) ---
    { id: 45, moviename: 'Iron Man', category: 9, year: 2008, language: 'en' },
    { id: 46, moviename: 'Logan', category: 9, year: 2017, language: 'en' },
    { id: 47, moviename: 'Spider-Man: Into the Spider-Verse', category: 9, year: 2018, language: 'en' },
    { id: 48, moviename: 'The Dark Knight Rises', category: 9, year: 2012, language: 'en' },

    // --- Comedy (10) ---
    { id: 49, moviename: 'The Hangover', category: 10, year: 2009, language: 'en' },
    { id: 50, moviename: 'Superbad', category: 10, year: 2007, language: 'en' },
    { id: 51, moviename: 'Groundhog Day', category: 10, year: 1993, language: 'en' },
    { id: 52, moviename: 'The Grand Budapest Hotel', category: 10, year: 2014, language: 'en' },

    // --- Animation (11) ---
    { id: 53, moviename: 'Coco', category: 11, year: 2017, language: 'en' },
    { id: 54, moviename: 'WALL\u00B7E', category: 11, year: 2008, language: 'en' },
    { id: 55, moviename: 'Spirited Away', category: 11, year: 2001, language: 'ja' }
  ];

  var USERS = [];
  var SEED_RATINGS = [];

  /**
   * Short synopsis + crew facts for well-known titles, keyed by a
   * normalized title. Movies without an entry fall back to a short
   * description generated from genre/year/language, so every poster
   * can show a card.
   */
  function detailKey(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var GENRE_BLURBS = {
    0: 'sci-fi story set in the future',
    1: 'high-octane action tale',
    2: 'tense thriller that keeps you guessing',
    3: 'hard-hitting drama',
    4: 'gritty crime story',
    5: 'biographical drama based on real lives',
    6: 'chilling horror story',
    7: 'warm romantic tale',
    8: 'sweeping adventure',
    9: 'superhero spectacle',
    10: 'feel-good comedy',
    11: 'beautifully drawn animation'
  };

  var MOVIE_DETAILS = {
    'avengers': {
      description: 'Earth\u2019s mightiest heroes unite when Loki threatens New York with an alien army.',
      director: 'Joss Whedon',
      leads: ['Robert Downey Jr.', 'Chris Evans', 'Scarlett Johansson']
    },
    'inception': {
      description: 'A thief who steals secrets from dreams is hired to plant an idea instead.',
      director: 'Christopher Nolan',
      leads: ['Leonardo DiCaprio', 'Marion Cotillard']
    },
    'oppenheimer': {
      description: 'The life of J. Robert Oppenheimer and the race to build the atomic bomb.',
      director: 'Christopher Nolan',
      leads: ['Cillian Murphy', 'Emily Blunt']
    },
    'interstellar': {
      description: 'A team of explorers travels through a wormhole to find a new home for humanity.',
      director: 'Christopher Nolan',
      leads: ['Matthew McConaughey', 'Anne Hathaway']
    },
    'kgf': {
      description: 'A ruthless young man rises from the streets of Kolar to rule a gold mine.',
      director: 'Prashanth Neel',
      leads: ['Yash', 'Srinidhi Shetty']
    },
    'batman': {
      description: 'Gotham\u2019s caped crusader faces his city\u2019s darkest threats.',
      director: 'Christopher Nolan',
      leads: ['Christian Bale']
    },
    'avengers endgame': {
      description: 'The surviving heroes assemble one last time to reverse Thanos\u2019 snap.',
      director: 'Anthony Russo',
      leads: ['Robert Downey Jr.', 'Chris Evans', 'Scarlett Johansson']
    },
    'the dark knight': {
      description: 'Batman faces the Joker, a criminal mastermind who wants to tear Gotham apart.',
      director: 'Christopher Nolan',
      leads: ['Christian Bale', 'Heath Ledger']
    },
    'shawshank redemption': {
      description: 'A wrongly convicted banker builds a new life inside a brutal prison.',
      director: 'Frank Darabont',
      leads: ['Tim Robbins', 'Morgan Freeman']
    },
    'the godfather': {
      description: 'The aging head of a crime dynasty passes control of his empire to his reluctant son.',
      director: 'Francis Ford Coppola',
      leads: ['Marlon Brando', 'Al Pacino']
    },
    'the matrix': {
      description: 'A hacker discovers reality is a simulation and joins the fight to free humanity.',
      director: 'The Wachowskis',
      leads: ['Keanu Reeves', 'Laurence Fishburne']
    },
    'arrival': {
      description: 'A linguist races to decode an alien language before a global conflict begins.',
      director: 'Denis Villeneuve',
      leads: ['Amy Adams', 'Jeremy Renner']
    },
    'blade runner 2049': {
      description: 'A new blade runner uncovers a secret that could change society forever.',
      director: 'Denis Villeneuve',
      leads: ['Ryan Gosling', 'Harrison Ford']
    },
    'dune': {
      description: 'A young nobleman is thrust into a war over the desert planet Arrakis.',
      director: 'Denis Villeneuve',
      leads: ['Timoth\u00E9e Chalamet', 'Zendaya']
    },
    'mad max fury road': {
      description: 'In a post-apocalyptic wasteland, Max helps Furiosa escape a tyrant\u2019s citadel.',
      director: 'George Miller',
      leads: ['Tom Hardy', 'Charlize Theron']
    },
    'john wick': {
      description: 'A retired hitman returns to the underworld to hunt the men who wronged him.',
      director: 'Chad Stahelski',
      leads: ['Keanu Reeves']
    },
    'die hard': {
      description: 'An off-duty cop takes on terrorists who seize an L.A. skyscraper on Christmas Eve.',
      director: 'John McTiernan',
      leads: ['Bruce Willis', 'Alan Rickman']
    },
    'gladiator': {
      description: 'A betrayed Roman general rises through the gladiator arena to avenge his family.',
      director: 'Ridley Scott',
      leads: ['Russell Crowe', 'Joaquin Phoenix']
    },
    'se7en': {
      description: 'Two detectives hunt a serial killer whose murders mirror the seven deadly sins.',
      director: 'David Fincher',
      leads: ['Brad Pitt', 'Morgan Freeman']
    },
    'zodiac': {
      description: 'A cartoonist and reporters chase the Zodiac killer who terrorised San Francisco.',
      director: 'David Fincher',
      leads: ['Jake Gyllenhaal', 'Robert Downey Jr.']
    },
    'gone girl': {
      description: 'A man becomes the prime suspect when his wife vanishes on their anniversary.',
      director: 'David Fincher',
      leads: ['Ben Affleck', 'Rosamund Pike']
    },
    'shutter island': {
      description: 'A U.S. marshal investigates a disappearance inside an island asylum.',
      director: 'Martin Scorsese',
      leads: ['Leonardo DiCaprio']
    },
    'forrest gump': {
      description: 'A kind-hearted man with a low IQ accidentally shapes decades of American history.',
      director: 'Robert Zemeckis',
      leads: ['Tom Hanks']
    },
    'parasite': {
      description: 'A poor family schemes to work for a wealthy household with shocking results.',
      director: 'Bong Joon-ho',
      leads: ['Song Kang-ho', 'Choi Woo-shik']
    },
    'whiplash': {
      description: 'A young drummer is pushed to his breaking point by a ruthless instructor.',
      director: 'Damien Chazelle',
      leads: ['Miles Teller', 'J.K. Simmons']
    },
    'the green mile': {
      description: 'A death-row guard discovers a gentle inmate with a miraculous gift.',
      director: 'Frank Darabont',
      leads: ['Tom Hanks', 'Michael Clarke Duncan']
    },
    'goodfellas': {
      description: 'The rise and fall of a mob associate inside the New York underworld.',
      director: 'Martin Scorsese',
      leads: ['Ray Liotta', 'Robert De Niro']
    },
    'pulp fiction': {
      description: 'Intertwined stories of crime, redemption and diner food in Los Angeles.',
      director: 'Quentin Tarantino',
      leads: ['John Travolta', 'Samuel L. Jackson']
    },
    'heat': {
      description: 'A master thief and a dedicated detective circle each other in L.A.',
      director: 'Michael Mann',
      leads: ['Al Pacino', 'Robert De Niro']
    },
    'scarface': {
      description: 'A Cuban refugee claws his way to the top of Miami\u2019s cocaine trade.',
      director: 'Brian De Palma',
      leads: ['Al Pacino']
    },
    'the wolf of wall street': {
      description: 'A stockbroker\u2019s meteoric rise and crash into fraud and excess.',
      director: 'Martin Scorsese',
      leads: ['Leonardo DiCaprio']
    },
    'catch me if you can': {
      description: 'An FBI agent chases a charming young con man who forged his way across the world.',
      director: 'Steven Spielberg',
      leads: ['Leonardo DiCaprio', 'Tom Hanks']
    },
    'the social network': {
      description: 'The founding of Facebook and the friendship that turned into a lawsuit.',
      director: 'David Fincher',
      leads: ['Jesse Eisenberg', 'Andrew Garfield']
    },
    'a beautiful mind': {
      description: 'A brilliant mathematician battles mental illness after revolutionising game theory.',
      director: 'Ron Howard',
      leads: ['Russell Crowe']
    },
    'hereditary': {
      description: 'A family unravels in the wake of a grandmother\u2019s unsettling death.',
      director: 'Ari Aster',
      leads: ['Toni Collette']
    },
    'the conjuring': {
      description: 'Paranormal investigators help a family terrorised by an evil presence.',
      director: 'James Wan',
      leads: ['Patrick Wilson', 'Vera Farmiga']
    },
    'get out': {
      description: 'A weekend visit to his girlfriend\u2019s family turns into a waking nightmare.',
      director: 'Jordan Peele',
      leads: ['Daniel Kaluuya']
    },
    'the shining': {
      description: 'A writer\u2019s family caretakes an empty hotel while he loses his mind.',
      director: 'Stanley Kubrick',
      leads: ['Jack Nicholson']
    },
    'la la land': {
      description: 'A jazz pianist and an aspiring actress chase their dreams in Los Angeles.',
      director: 'Damien Chazelle',
      leads: ['Ryan Gosling', 'Emma Stone']
    },
    'the notebook': {
      description: 'A love story spanning decades between a poor mill worker and a wealthy girl.',
      director: 'Nick Cassavetes',
      leads: ['Ryan Gosling', 'Rachel McAdams']
    },
    'before sunrise': {
      description: 'Two strangers spend one unforgettable night walking and talking through Vienna.',
      director: 'Richard Linklater',
      leads: ['Ethan Hawke', 'Julie Delpy']
    },
    'raiders of the lost ark': {
      description: 'Archaeologist Indiana Jones races Nazis for a biblical artifact.',
      director: 'Steven Spielberg',
      leads: ['Harrison Ford']
    },
    'jurassic park': {
      description: 'A dinosaur theme park goes terrifyingly wrong when the power fails.',
      director: 'Steven Spielberg',
      leads: ['Sam Neill', 'Laura Dern']
    },
    'the lord of the rings the fellowship of the ring': {
      description: 'A hobbit sets out to destroy a powerful ring before evil finds it.',
      director: 'Peter Jackson',
      leads: ['Elijah Wood', 'Ian McKellen']
    },
    'life of pi': {
      description: 'A shipwrecked boy survives on a lifeboat with a tiger named Richard Parker.',
      director: 'Ang Lee',
      leads: ['Suraj Sharma']
    },
    'iron man': {
      description: 'A billionaire inventor builds a powered suit and becomes a hero.',
      director: 'Jon Favreau',
      leads: ['Robert Downey Jr.']
    },
    'logan': {
      description: 'An aging Wolverine takes one last mission to protect a young mutant.',
      director: 'James Mangold',
      leads: ['Hugh Jackman', 'Patrick Stewart']
    },
    'spider-man into the spider-verse': {
      description: 'A teen spider-hero teams up with spider-versions of himself across dimensions.',
      director: 'Bob Persichetti',
      leads: ['Shameik Moore']
    },
    'the dark knight rises': {
      description: 'Batman returns to a Gotham under siege by the masked Bane.',
      director: 'Christopher Nolan',
      leads: ['Christian Bale', 'Tom Hardy']
    },
    'the hangover': {
      description: 'Three groomsmen retrace a wild Las Vegas night to find the missing groom.',
      director: 'Todd Phillips',
      leads: ['Bradley Cooper', 'Zach Galifianakis']
    },
    'superbad': {
      description: 'Two high-school seniors attempt the impossible to impress their crushes.',
      director: 'Greg Mottola',
      leads: ['Jonah Hill', 'Michael Cera']
    },
    'groundhog day': {
      description: 'A cynical weatherman is trapped reliving the same day over and over.',
      director: 'Harold Ramis',
      leads: ['Bill Murray', 'Andie MacDowell']
    },
    'the grand budapest hotel': {
      description: 'A legendary concierge and his lobby boy are caught up in a family saga.',
      director: 'Wes Anderson',
      leads: ['Ralph Fiennes']
    },
    'coco': {
      description: 'A boy travels to the Land of the Dead to uncover his family\u2019s past.',
      director: 'Lee Unkrich',
      leads: ['Anthony Gonzalez']
    },
    'walle': {
      description: 'A lonely trash-compacting robot finds love and saves humanity.',
      director: 'Andrew Stanton',
      leads: ['Ben Burtt']
    },
    'spirited away': {
      description: 'A girl must free her parents by working in a bathhouse of the spirits.',
      director: 'Hayao Miyazaki',
      leads: ['Daveigh Chase']
    },
    'barbie': {
      description: 'A doll leaves Barbie Land for the real world and questions what it means to be human.',
      director: 'Greta Gerwig',
      leads: ['Margot Robbie', 'Ryan Gosling']
    },
    'joker': {
      description: 'A failed comedian descends into madness in a decaying Gotham City.',
      director: 'Todd Phillips',
      leads: ['Joaquin Phoenix']
    },
    'top gun maverick': {
      description: 'A veteran pilot trains a new generation of aviators for a deadly mission.',
      director: 'Joseph Kosinski',
      leads: ['Tom Cruise']
    },
    'dune part two': {
      description: 'Paul Atreides unites with the Fremen to avenge his family and claim Arrakis.',
      director: 'Denis Villeneuve',
      leads: ['Timoth\u00E9e Chalamet', 'Zendaya']
    },
    'titanic': {
      description: 'A young couple falls in love aboard the doomed maiden voyage of the Titanic.',
      director: 'James Cameron',
      leads: ['Leonardo DiCaprio', 'Kate Winslet']
    }
  };

  function getMovieDetails(movie) {
    var entry = MOVIE_DETAILS[detailKey(movie && movie.moviename)];
    if (entry) {
      return {
        description: entry.description,
        director: entry.director || null,
        leads: entry.leads || []
      };
    }
    var lang = getLanguage(movie && movie.language);
    var blurb = GENRE_BLURBS[movie.category] || 'compelling story';
    var langPart = lang && lang.label && lang.label.toLowerCase() !== 'english' ? ' in ' + lang.label : '';
    var desc = 'A ' + (movie.year ? movie.year + ' ' : '') + blurb + langPart + '.';
    return { description: desc, director: null, leads: [] };
  }

  global.FilmphileData = {
    CATEGORIES: CATEGORIES,
    LANGUAGES: LANGUAGES,
    getCategory: getCategory,
    getLanguage: getLanguage,
    getMovieDetails: getMovieDetails,
    MOVIES: MOVIES,
    USERS: USERS,
    SEED_RATINGS: SEED_RATINGS
  };
})(window);
