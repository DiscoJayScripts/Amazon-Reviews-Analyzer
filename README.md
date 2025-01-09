# **Amazon Reviews Analyzer**

## **Why?**

Unfortunately, Amazon doesn't provide any useful tools to keep track of your own reviews. You can keep scrolling down on your profile page to slowly load more and more of your reviews, but there is no way to get any kind of overview or keep track of changes.

## **How?**

To install the script, follow these steps:

1. Make sure you have a UserScript manager installed in your browser (ViolentMonkey, TamperMonkey, ...)
2. Install the userscript from the repository: **`cd project-title`**
3. Navigate to your Amazon profile page:
   
   US: https://www.amazon.com/gp/profile
   
   DE: https://www.amazon.de/gp/profile
   
   etc.
4. You should now see an additional section. Click the first button to read all your reviews.
5. Wait for all your reviews to finish loading. Depending on the total amount, this might take a short while. It takes about 1 second to read 100 reviews.
6. Repeat this process every now and then. All reviews with an updated hearts count will be shown separately.

## **Some notes**

- None of your data leaves your browser.
- Everything is either displayed dynamically or stored locally in your browser's localStorage.
- Nothing is updated automatically. You can to run the scan manually as often as you like.
