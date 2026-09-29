CREATE DATABASE IF NOT EXISTS movierecommend;
USE movierecommend;

DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS languages;

CREATE TABLE categories (
  id INT PRIMARY KEY,
  `key` VARCHAR(20) NOT NULL,
  label VARCHAR(30) NOT NULL,
  emoji VARCHAR(10) NOT NULL
);

CREATE TABLE languages (
  id VARCHAR(5) PRIMARY KEY,
  label VARCHAR(30) NOT NULL
);

CREATE TABLE movies (
  id INT PRIMARY KEY,
  moviename VARCHAR(100) NOT NULL,
  category INT NOT NULL,
  year INT NOT NULL,
  language VARCHAR(5) NOT NULL,
  poster_url VARCHAR(255),
  FOREIGN KEY (category) REFERENCES categories(id),
  FOREIGN KEY (language) REFERENCES languages(id)
);

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  movie_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_movie (user_id, movie_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (movie_id) REFERENCES movies(id)
);

INSERT INTO categories (id, `key`, label, emoji) VALUES
(0, 'scify', 'Sci-Fi', '🚀'),
(1, 'actionfilm', 'Action', '💥'),
(2, 'thriller', 'Thriller', '🔪'),
(3, 'drama', 'Drama', '🎭'),
(4, 'crime', 'Crime', '🕵️'),
(5, 'biography', 'Biography', '📖'),
(6, 'horror', 'Horror', '👻'),
(7, 'romance', 'Romance', '💖'),
(8, 'adventure', 'Adventure', '🧭'),
(9, 'superhero', 'Superhero', '🦸'),
(10, 'comedy', 'Comedy', '😂'),
(11, 'animation', 'Animation', '🎨');

INSERT INTO languages (id, label) VALUES
('en', 'English'),
('hi', 'Hindi'),
('kn', 'Kannada'),
('ko', 'Korean'),
('ja', 'Japanese'),
('es', 'Spanish'),
('fr', 'French');

INSERT INTO movies (id, moviename, category, year, language, poster_url) VALUES
(0, 'Avengers', 9, 2012, 'en', 'https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg'),
(1, 'Inception', 0, 2010, 'en', 'https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg'),
(2, 'Oppenheimer', 5, 2023, 'en', 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'),
(3, 'Interstellar', 0, 2014, 'en', 'https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg'),
(4, 'KGF', 1, 2018, 'kn', 'https://image.tmdb.org/t/p/w500/ltHlJwvxKv7d0ooCiKSAvfwV9tX.jpg'),
(5, 'Batman', 9, 2008, 'en', 'https://image.tmdb.org/t/p/w500/cij4dd21v2Rk2YtUQbV5kW69WB2.jpg'),
(6, 'Avengers: Endgame', 9, 2019, 'en', 'https://image.tmdb.org/t/p/w500/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg'),
(7, 'The Dark Knight', 2, 2008, 'en', 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg'),
(8, 'Shawshank Redemption', 3, 1994, 'en', 'https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg'),
(9, 'The Godfather', 4, 1972, 'en', 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg'),
(10, 'The Matrix', 0, 1999, 'en', 'https://image.tmdb.org/t/p/w500/aOIuZAjPaRIE6CMzbazvcHuHXDc.jpg'),
(11, 'Arrival', 0, 2016, 'en', 'https://image.tmdb.org/t/p/w500/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg'),
(12, 'Blade Runner 2049', 0, 2017, 'en', 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg'),
(13, 'Dune', 0, 2021, 'en', 'https://image.tmdb.org/t/p/w500/v1tRXZ4JtD2Iv6fjkPvT4GiwslV.jpg'),
(14, 'Mad Max: Fury Road', 1, 2015, 'en', 'https://image.tmdb.org/t/p/w500/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg'),
(15, 'John Wick', 1, 2014, 'en', 'https://image.tmdb.org/t/p/w500/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg'),
(16, 'Die Hard', 1, 1988, 'en', 'https://image.tmdb.org/t/p/w500/7Bjd8kfmDSOzpmhySpEhkUyK2oH.jpg'),
(17, 'Gladiator', 1, 2000, 'en', 'https://image.tmdb.org/t/p/w500/wN2xWp1eIwCKOD0BHTcErTBv1Uq.jpg'),
(18, 'Se7en', 2, 1995, 'en', 'https://image.tmdb.org/t/p/w500/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg'),
(19, 'Zodiac', 2, 2007, 'en', 'https://image.tmdb.org/t/p/w500/6YmeO4pB7XTh8P8F960O1uA14JO.jpg'),
(20, 'Gone Girl', 2, 2014, 'en', 'https://image.tmdb.org/t/p/w500/ts996lKsxvjkO2yiYG0ht4qAicO.jpg'),
(21, 'Shutter Island', 2, 2010, 'en', 'https://image.tmdb.org/t/p/w500/nrmXQ0zcZUL8jFLrakWc90IR8z9.jpg'),
(22, 'Forrest Gump', 3, 1994, 'en', 'https://image.tmdb.org/t/p/w500/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg'),
(23, 'Parasite', 3, 2019, 'ko', 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg'),
(24, 'Whiplash', 3, 2014, 'en', 'https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg'),
(25, 'The Green Mile', 3, 1999, 'en', 'https://image.tmdb.org/t/p/w500/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg'),
(26, 'Goodfellas', 4, 1990, 'en', 'https://image.tmdb.org/t/p/w500/9OkCLM73MIU2CrKZbqiT8Ln1wY2.jpg'),
(27, 'Pulp Fiction', 4, 1994, 'en', 'https://image.tmdb.org/t/p/w500/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg'),
(28, 'Heat', 4, 1995, 'en', 'https://image.tmdb.org/t/p/w500/zMyfPUelumio3tiDKPffaUpsQTD.jpg'),
(29, 'Scarface', 4, 1983, 'en', 'https://image.tmdb.org/t/p/w500/zr2p353wrd6j3wjLgDT4TcaestB.jpg'),
(30, 'The Wolf of Wall Street', 5, 2013, 'en', 'https://image.tmdb.org/t/p/w500/vK1o5rZGqxyovfIhZyMELhk03wO.jpg'),
(31, 'Catch Me If You Can', 5, 2002, 'en', 'https://image.tmdb.org/t/p/w500/tBU34nIAKx4aZuGkBcGEg2o0LuG.jpg'),
(32, 'The Social Network', 5, 2010, 'en', 'https://image.tmdb.org/t/p/w500/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg'),
(33, 'A Beautiful Mind', 5, 2001, 'en', 'https://image.tmdb.org/t/p/w500/zwzWCmH72OSC9NA0ipoqw5Zjya8.jpg'),
(34, 'Hereditary', 6, 2018, 'en', 'https://image.tmdb.org/t/p/w500/hjlZSXM86wJrfCv5VKfR5DI2VeU.jpg'),
(35, 'The Conjuring', 6, 2013, 'en', 'https://image.tmdb.org/t/p/w500/wVYREutTvI2tmxr6ujrHT704wGF.jpg'),
(36, 'Get Out', 6, 2017, 'en', 'https://image.tmdb.org/t/p/w500/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg'),
(37, 'The Shining', 6, 1980, 'en', 'https://image.tmdb.org/t/p/w500/9fgh3Ns1iRzlQNYuJyK0ARQZU7w.jpg'),
(38, 'La La Land', 7, 2016, 'en', 'https://image.tmdb.org/t/p/w500/ylXCdC106IKiarftHkcacasaAcb.jpg'),
(39, 'The Notebook', 7, 2004, 'en', 'https://image.tmdb.org/t/p/w500/qdIMHd4sEfJSckfVJfKQvisL02a.jpg'),
(40, 'Before Sunrise', 7, 1995, 'en', 'https://image.tmdb.org/t/p/w500/jsQy4ZbPHA8hE2O6QU05PpofI61.jpg'),
(41, 'Raiders of the Lost Ark', 8, 1981, 'en', 'https://image.tmdb.org/t/p/w500/tjGpsV0vKKHECtdsQoVwIXsDj3.jpg'),
(42, 'Jurassic Park', 8, 1993, 'en', 'https://image.tmdb.org/t/p/w500/oU7Oq2kFAAlGqbU4VoAE36g4hoI.jpg'),
(43, 'The Lord of the Rings: The Fellowship of the Ring', 8, 2001, 'en', 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg'),
(44, 'Life of Pi', 8, 2012, 'en', 'https://image.tmdb.org/t/p/w500/iLgRu4hhSr6V1uManX6ukDriiSc.jpg'),
(45, 'Iron Man', 9, 2008, 'en', 'https://image.tmdb.org/t/p/w500/78lPtwv72eTNqFW9COBYI0dWDJa.jpg'),
(46, 'Logan', 9, 2017, 'en', 'https://image.tmdb.org/t/p/w500/fnbjcEfVsIyTDsKBEaoLb3XjHqq.jpg'),
(47, 'Spider-Man: Into the Spider-Verse', 9, 2018, 'en', 'https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg'),
(48, 'The Dark Knight Rises', 9, 2012, 'en', 'https://image.tmdb.org/t/p/w500/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg'),
(49, 'The Hangover', 10, 2009, 'en', 'https://image.tmdb.org/t/p/w500/eshEkiG7NmU4ekA8CtpIdYiYufZ.jpg'),
(50, 'Superbad', 10, 2007, 'en', 'https://image.tmdb.org/t/p/w500/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg'),
(51, 'Groundhog Day', 10, 1993, 'en', 'https://image.tmdb.org/t/p/w500/zgvKavg11JmPkN5J75eFGq8g4Y8.jpg'),
(52, 'The Grand Budapest Hotel', 10, 2014, 'en', 'https://image.tmdb.org/t/p/w500/nX5XotM9yprCKarRH4fzOq1VM1J.jpg'),
(53, 'Coco', 11, 2017, 'en', 'https://image.tmdb.org/t/p/w500/eKi8dIrr8voobbaGzDpe8w0PVbC.jpg'),
(54, 'WALL·E', 11, 2008, 'en', 'https://image.tmdb.org/t/p/w500/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg'),
(55, 'Spirited Away', 11, 2001, 'ja', 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg');

INSERT INTO users (id, name) VALUES
(1, 'Aayush'),
(2, 'Aniket'),
(3, 'Mayuresh'),
(4, 'Prathamesh'),
(5, 'Yuvraj');

INSERT INTO ratings (user_id, movie_id, rating) VALUES
(1, 0, 5), (1, 1, 2), (1, 2, 4), (1, 3, 3), (1, 5, 5), (1, 6, 1), (1, 7, 4), (1, 8, 3), (1, 9, 2),
(2, 0, 2), (2, 1, 4), (2, 2, 5), (2, 3, 3), (2, 5, 3), (2, 6, 4), (2, 7, 2), (2, 8, 5),
(3, 0, 1), (3, 1, 5), (3, 2, 4), (3, 3, 2), (3, 4, 3), (3, 5, 1), (3, 6, 2), (3, 7, 5), (3, 8, 4), (3, 9, 3),
(4, 0, 4), (4, 1, 2), (4, 2, 3), (4, 3, 5), (4, 4, 1), (4, 5, 4), (4, 6, 5), (4, 7, 3), (4, 8, 2), (4, 9, 1),
(5, 1, 3), (5, 2, 1), (5, 3, 4), (5, 4, 5), (5, 5, 5), (5, 6, 3), (5, 7, 4), (5, 9, 5);
