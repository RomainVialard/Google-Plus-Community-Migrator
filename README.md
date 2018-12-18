# Google Plus Community Migrator

Google+ will be shutdown for consumers in April 2019 (see [blog post](https://www.blog.google/technology/safety-security/expediting-changes-google-plus/)).

This repository presents a way to export posts from a Google+ community (in this case the [Google Apps Script](https://plus.google.com/u/0/communities/102471985047225101769) community), along with comments & likes (plusones) using the Google+ REST API and import them in a Firebase Database, then use Firebase Hosting to display those posts.
To see a live result, simply open this URL:
https://apps-script-community-archive.firebaseapp.com/

Note that this is a demo / work in progress.
Of course it is possible to simply move to another existing social network / online forum.
But this demo shows that we can export all data from an existing community, to avoid losing it.
Plus, by using Google authentication to log in this Firebase web app, each user is correctly recognized (your +1, comments,... are correctly attributed to you).


