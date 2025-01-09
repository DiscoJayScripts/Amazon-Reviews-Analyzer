# **Amazon Reviews Analyzer**

## **Why?**

Unfortunately, Amazon doesn't provide any useful tools to keep track of your own reviews. You can keep scrolling down on your profile page to slowly load more and more of your reviews, but there is no way to get any kind of overview or keep track of changes.

This script was created to change that. With a click of a button, all your reviews will be loaded, sorted by their number of hearts (= helpful votes) and presented in a list. Reapeating this scan after a while, will also present all updated votes in a separate overview.

## **How?**

To install the script, follow these steps:

1. Make sure you have a UserScript manager installed in your browser (ViolentMonkey, TamperMonkey, ...). If you don't have any, simply search for "ViolentMonkey" on your browser's extension page and install it.
2. Install the userscript from the repository:
  
   https://github.com/DiscoJayScripts/Amazon-Reviews-Analyzer/blob/main/Amazon-Reviews-Analyzer.user.js
5. Navigate to your Amazon profile page:
   
   US: https://www.amazon.com/gp/profile
   
   DE: https://www.amazon.de/gp/profile
   
   etc.
6. You should now see an additional section. Click the first button to fetch all your reviews.
7. Wait for all your reviews to finish loading. Depending on the total amount, this might take a short while. It takes about 1 second to read 100 reviews.
8. Repeat this process every now and then. All reviews with an updated hearts count will be shown separately.

## **Some notes**

- None of your data leaves your browser.
- Everything is either displayed dynamically or stored locally in your browser's localStorage.
- Nothing is updated automatically. You can to run the scan manually as often as you like.
- This only works on your own profile page. It does not work for any other user profiles.

![AmazonReviewsAnalyzer-Screenshot01](https://github.com/user-attachments/assets/0b8e2454-f6fc-4463-8068-f5ba6b7919b9)
