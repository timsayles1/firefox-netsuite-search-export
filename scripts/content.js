/*
*
* This script handles injecting code into the site
*
*/

// Inject script into the main page
var a = document.createElement('script');
a.type = 'text/javascript';
a.src = browser.runtime.getURL('scripts/jquery-ui.min.js');
var b = document.createElement('script');
b.type = 'text/javascript';
b.src = browser.runtime.getURL('scripts/ns_ss_export.js');
var s = document.getElementsByTagName('script')[0];
s.parentNode.insertBefore(a, s);
s.parentNode.insertBefore(b, s);
s.onload = function() {
    this.remove();
};