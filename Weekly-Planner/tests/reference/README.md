# Picture-test references

`tests/pictures.js` compares each picture it takes with the file of the same
name here: `<state>-<user>-<ipad|phone>-<pop|calm>.png`.

References come only from the CI Linux runner (fonts and the browser build
differ elsewhere). To refresh them, download the `pictures` artifact of a CI
run and copy its `pictures-new/` files into this folder. See `tests/README.md`.
