# **Amazon Reviews Analyzer**

## **Why?**

Unfortunately, Amazon doesn't provide any useful tools to keep track of your own reviews. You can keep scrolling down on your profile page to slowly load more and more of your reviews, but there is no way to get any kind of overview or keep track of changes.

This script was created to change that. With a click of a button, all your reviews will be loaded, sorted by their number of hearts (= helpful votes) and presented in a list. Repeating this scan after a while, will also present all updated votes in a separate overview.

## **How?**

To install the script, follow these steps:

1. Make sure you have a UserScript manager installed in your browser (ViolentMonkey, TamperMonkey, ...). If you don't have any, simply search for "ViolentMonkey" on your browser's extension page and install it.
2. Install the userscript from the repository:
  
   https://github.com/DiscoJayScripts/Amazon-Reviews-Analyzer/raw/main/Amazon-Reviews-Analyzer.user.js
5. Navigate to your Amazon profile page:
   
   US: https://www.amazon.com/profile

   UK: https://www.amazon.co.uk/profile

   CA: https://www.amazon.ca/profile

   DE: https://www.amazon.de/profile

   FR: https://www.amazon.fr/profile
   
   etc. (just add `/profile` after your country's main Amazon URL)
7. You should now see an additional section. Click the first button to fetch all your reviews.
8. Wait for all your reviews to finish loading. Depending on the total amount, this might take a short while. It takes about 1 second to read 100 reviews.
9. Repeat this process every now and then. All reviews with an updated hearts count will be shown separately.

## **Notes**

- None of your data leaves your browser.
- Everything is either displayed dynamically or stored locally in your browser's localStorage.
- Nothing is updated automatically. You can run the scan manually as often as you like.
- This only works on your own profile page. It does not work for any other user profiles.

## **Screenshots**
After your first scan, you will only see the default list with all reviews that have been marked as helpful at least once.

The green and blue lines will come up as soon as updated heart counts are found with one of your future scans.

![2025-01-09 Amazon Review Analyzer](https://github.com/user-attachments/assets/6b698742-e51b-40de-9bd8-5bf1cfe5b53b)
