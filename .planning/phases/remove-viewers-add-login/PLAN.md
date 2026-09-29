# Plan: Remove Active Viewers, Add Login-on-Submit

## Goal
Replace the current multi-viewer system with a single-user login flow. Users browse freely but must log in (enter a name) before submitting a rating. The logged-in user is persisted in localStorage. The 5 seeded users (Aayush, Aniket, Mayuresh, Prathamesh, Yuvraj) are removed entirely.

## Files to modify
- `assets/js/app.js` — main changes (state, login modal, rate gating, remove panel 4)
- `assets/js/data.js` — remove USERS seed array
- `server.js` — remove DEFAULT_USERS, make store start with empty users array
- `assets/css/styles.css` — add login modal styles

## Changes

### 1. `assets/js/app.js`

#### a. Add `state.loginName` to initial state (line ~40)
- Add `loginName: ''` to the `state` object for the login modal input binding.

#### b. Add `loginUser()` function (near addUser, ~line 272)
```js
function loginUser() {
  var name = state.loginName.trim();
  if (!name) return;
  API.addUser(name).then(function (newUser) {
    state.users.push(newUser);
    state.activeUserId = newUser.id;
    CineMatchStorage.save('cinematch_current_user', { id: newUser.id, name: newUser.name });
    state.showLoginModal = false;
    state.loginName = '';
    render();
  }).catch(function (err) {
    console.error('Failed to create user:', err);
  });
}
```

#### c. Add `logoutUser()` function
```js
function logoutUser() {
  state.activeUserId = null;
  state.users = [];
  CineMatchStorage.save('cinematch_current_user', null);
  render();
}
```

#### d. Modify `rate()` function (line 259) — gate on login
- Before rating, check if `activeUser()` returns null. If null, show login modal instead of returning silently.
```js
function rate(movieId, value) {
  var user = activeUser();
  if (!user) {
    state.showLoginModal = true;
    state.loginCallback = function() { rate(movieId, value); };
    render();
    return;
  }
  // ... rest unchanged
}
```

#### e. Add `state.showLoginModal = false` and `state.loginCallback = null` to initial state

#### f. Create `buildLoginModal()` function
- Renders a centered modal overlay with:
  - "Please enter your name to continue" heading
  - Text input bound to `state.loginName`
  - "Continue" button calling `loginUser()`
  - "Cancel" button closing the modal
- Only rendered when `state.showLoginModal === true`

#### g. Modify `addViewerPanel()` → replace with login/profile panel (panel 4)
- Remove the current viewers list and "Create & switch" form
- Instead show the logged-in user's name with a "Logout" button
- If no user is logged in, show "Not logged in" with a "Login" button that opens the modal

#### h. Modify `render()` — append login modal to body
- After all other rendering, call `buildLoginModal()` and append to `#app` if `state.showLoginModal` is true.

#### i. Modify `init()` (~line 1600)
- On startup, check `CineMatchStorage.load('cinematch_current_user')`. If found, set `state.activeUserId` to that user's id and add user to `state.users`.
- Remove the line `state.activeUserId = USERS[0].id` (no default user).

#### j. Remove dead code
- Remove the `addUser()` function (lines 272-285) since it's replaced by `loginUser()`.
- Clean up references to `state.newUserName`.

### 2. `assets/js/data.js`

- Remove or empty the `USERS` array (line 143-149). Set to `var USERS = [];`.

### 3. `server.js`

- Change `DEFAULT_USERS` (line 418-424) to `var DEFAULT_USERS = [];`.
- In the store initialization, start with empty users: `users: DEFAULT_USERS.slice()`.

### 4. `assets/css/styles.css`

- Add styles for the login modal overlay and form:
  - `.login-modal-overlay` — fixed full-screen dark backdrop
  - `.login-modal` — centered card with the form
  - `.login-modal input` and `.login-modal button` — styled inputs

## Verification
1. Open `index.html` in a browser — no default users should appear
2. Browse movies freely without login
3. Click a movie, pick stars, click Submit → login modal appears
4. Enter name → user created, rating saved, modal closes
5. Click another movie → submit works immediately (user already logged in)
6. Panel 4 shows logged-in user info with logout option
7. Refresh page → login persists from localStorage
