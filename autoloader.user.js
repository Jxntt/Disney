// ==UserScript==
// @name BG1 Autoloader
// @namespace https://jxntt.github.io/Disney/
// @version 0.1
// @description Automatically loads the BG1 interface
// @author Jxntt
// @match https://jxntt.github.io/Disney/start.html
// @match https://disneyworld.disney.go.com/vas/
// @match https://disneyworld.disney.go.com/*/vas/
// @match https://disneyland.disney.go.com/vas/
// @match https://disneyland.disney.go.com/*/vas/
// @match https://vqguest-svc-wdw.wdprapps.disney.com/application/v1/guest/getQueues
// @match https://vqguest-svc.wdprapps.disney.com/application/v1/guest/getQueues
// @grant none
// ==/UserScript==
'use strict';

const bg1Url = 'https://jxntt.github.io/Disney/';

if (window.location.href === bg1Url + 'start.html') {
  document.body.classList.add('autoload');
} else {
  document.open();
  document.write('');
  document.close();
  const script = document.createElement('script');
  script.type = 'module';
  script.src = bg1Url + 'bg1.js';
  document.head.appendChild(script);
}
