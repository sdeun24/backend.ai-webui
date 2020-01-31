// Modules to control application life and create native browser window / Local tester file
const {app, Menu, shell, BrowserWindow, BrowserView, protocol, clipboard, dialog, ipcMain} = require('electron');
process.env.electronPath = app.getAppPath();
process.env.serveMode = "dev";
process.env.liveDebugMode = false;
const url = require('url');
const path = require('path');
const toml = require('markty-toml');
const nfs = require('fs');
const npjoin = require('path').join;
const BASE_DIR = __dirname;
let ProxyManager, versions, es6Path, electronPath, mainIndex;
if (process.env.serveMode == 'dev') {
  ProxyManager = require('./build/electron-app/app/wsproxy/wsproxy.js');
  versions = require('./version');
  es6Path = npjoin(__dirname, 'build/electron-app/app');  // ES6 module loader with custom protocol
  electronPath = npjoin(__dirname, 'build/electron-app');
  mainIndex = 'build/electron-app/app.html';
} else {
  ProxyManager = require('./app/wsproxy/wsproxy.js');
  versions = require('./app/version');
  es6Path = npjoin(__dirname, 'app');  // ES6 module loader with custom protocol
  electronPath = npjoin(__dirname);
  mainIndex = 'app.html';
}
let windowWidth = 1280;
let windowHeight = 970;
let debugMode = true;
let tabStore = [];

protocol.registerSchemesAsPrivileged([
  {scheme: 'es6', privileges: {standard: true, secure: true, bypassCSP: true}}
]);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let mainContent;
let devtools;
let manager = new ProxyManager();
let mainURL;

app.once('ready', function() {
  var template;
  if (process.platform === 'darwin') {
    template = [
      {
        label: 'Backend.AI',
        submenu: [
          {
            label: 'About Backend.AI App',
            click: function () {
              let scr = `window.runScriptOnMainTab();`;
              mainContent.executeJavaScript('window.showSplash();');
            }
          },
          {
            label: 'App version ' + versions.package + ' (rev.' + versions.revision + ')',
            click: function () {
              clipboard.writeText(versions.package + ' (rev.' + versions.revision + ')');
              const response = dialog.showMessageBox({
                type: 'info',
                message: 'Version information is copied to clipboard.'
              });
            }
          },
          {
            type: 'separator'
          },
          {
            label: 'Force Update Screen',
            click: function () {
              mainContent.reloadIgnoringCache();
            }
          },
          {
            type: 'separator'
          },
          {
            label: 'Services',
            submenu: []
          },
          {
            type: 'separator'
          },
          {
            label: 'Hide Backend.AI Console',
            accelerator: 'Command+H',
            selector: 'hide:'
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Shift+H',
            selector: 'hideOtherApplications:'
          },
          {
            label: 'Show All',
            selector: 'unhideAllApplications:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: function () {
              app.quit();
            }
          },
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'Command+Z',
            selector: 'undo:'
          },
          {
            label: 'Redo',
            accelerator: 'Shift+Command+Z',
            selector: 'redo:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Cut',
            accelerator: 'Command+X',
            selector: 'cut:'
          },
          {
            label: 'Copy',
            accelerator: 'Command+C',
            selector: 'copy:'
          },
          {
            label: 'Paste',
            accelerator: 'Command+V',
            selector: 'paste:'
          },
          {
            label: 'Select All',
            accelerator: 'Command+A',
            selector: 'selectAll:'
          },
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Zoom In',
            accelerator: 'Command+=',
            click: function () {
              var focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow && focusedWindow.webContents) {
                focusedWindow.webContents.executeJavaScript('_zoomIn()');
              }
            }
          },
          {
            label: 'Zoom Out',
            accelerator: 'Command+-',
            click: function () {
              var focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow && focusedWindow.webContents) {
                focusedWindow.webContents.executeJavaScript('_zoomOut()');
              }
            }
          },
          {
            label: 'Actual Size',
            accelerator: 'Command+0',
            click: function () {
              var focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow && focusedWindow.webContents) {
                focusedWindow.webContents.executeJavaScript(
                  '_zoomActualSize()');
              }
            }
          },
          {
            label: 'Toggle Full Screen',
            accelerator: 'Ctrl+Command+F',
            click: function () {
              var focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
              }
            }
          },
        ]
      },
      {
        label: 'Window',
        submenu: [
          {
            label: 'Minimize',
            accelerator: 'Command+M',
            selector: 'performMiniaturize:'
          },
          {
            label: 'Close',
            accelerator: 'Command+W',
            selector: 'performClose:'
          },
          {
            type: 'separator'
          },
          {
            label: 'Bring All to Front',
            selector: 'arrangeInFront:'
          },
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Backend.AI Webpage',
            click: function () {
              shell.openExternal('https://www.backend.ai/');
            }
          }
        ]
      }
    ];
  } else {
    template = [
      {
        label: '&File',
        submenu: [
          {
            label: 'Refresh App',
            accelerator: 'CmdOrCtrl+R',
            click: function() {
              const proxyUrl = `http://localhost:${manager.port}/`;
              mainWindow.loadURL(url.format({ // Load HTML into new Window
                pathname: path.join(mainIndex),
                protocol: 'file',
                slashes: true
              }));
              mainContent.executeJavaScript(`window.__local_proxy = '${proxyUrl}'`);
              console.log('Re-connected to proxy: ' + proxyUrl);
            }
          },
          {
            type: 'separator'
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: function() {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.close();
              }
            }
          },
        ]
      },
      {
        label: '&View',
        submenu: [
          {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            role: 'zoomin'
          },
          {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            role: 'zoomout'
          },
          {
            label: 'Actual Size',
            accelerator: 'CmdOrCtrl+0',
            role: 'resetzoom'
          },
          {
            label: 'Toggle &Full Screen',
            accelerator: 'F11',
            role: 'togglefullscreen'
          },
          /* Does not work
          {
            label: 'Toggle &Developer Tools',
            accelerator: 'Alt+Ctrl+I',
            click: function() {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.toggleDevTools();
              }
            }
          },
          */
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Backend.AI Webpage',
            click: function () {
              shell.openExternal('https://www.backend.ai/');
            }
          }
        ]
      }
    ];
  }

  const appmenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appmenu);
});


function createWindow() {
  // Create the browser window.
  devtools = null;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    title: "Backend.AI",
    frame: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nativeWindowOpen: true,
      nodeIntegration: true,
      webviewTag: true,
      preload: path.join(electronPath, 'preload.js'),
      devTools: true
    }
  });
  // and load the index.html of the app.
  if (process.env.liveDebugMode === true) {
    // Load HTML into new Window (dynamic serving for develop)
    mainWindow.loadURL(url.format({
      pathname: '127.0.0.1:9081',
      protocol: 'http',
      slashes: true
    }));
  } else {
    // Load HTML into new Window (file-based serving)
    nfs.readFile(path.join(es6Path, 'config.toml'), 'utf-8', (err, data) => {
      if (err) {
        console.log('No configuration file found.');
        return;
      }
      let config = toml(data);
      if ('wsproxy' in config && 'disableCertCheck' in config.wsproxy && config.wsproxy.disableCertCheck == true) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      if ('server' in config && 'consoleServerURL' in config.server && config.server.consoleServerURL != "") {
        mainURL = config.server.consoleServerURL;
      } else {
        mainURL = url.format({
          pathname: path.join(mainIndex),
          protocol: 'file',
          slashes: true
        });
      }
      if ('general' in config && 'siteDescription' in config.general) {
        process.env.siteDescription = config.general.siteDescription;
      } else {
        process.env.siteDescription = '';
      }
      mainWindow.loadURL(mainURL);
    });
  }
  mainContent = mainWindow.webContents;
  if (debugMode === true) {
    devtools = new BrowserWindow();
    mainWindow.webContents.setDevToolsWebContents(devtools.webContents);
    mainWindow.webContents.openDevTools({mode: 'detach'});
  }
  // Emitted when the window is closed.
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      e.preventDefault();
      mainWindow.webContents.send('app-close-window');
    }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    manager.once("ready", () => {
      let url = 'http://localhost:' + manager.port + "/";
      console.log("Proxy is ready:" + url);
      mainWindow.webContents.send('proxy-ready', url);
    });
    manager.start();
  });

  ipcMain.on('app-closed', _ => {
    if (process.platform !== 'darwin') {  // Force close app when it is closed even on macOS.
      //app.quit()
    }
    mainWindow = null;
    mainContent = null;
    devtools = null;
    app.quit()
  });
  mainWindow.on('closed', function () {
    mainWindow = null;
    mainContent = null;
    devtools = null;
  });
  console.log("qweqeqweqweqwe");
  mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    console.log('---------------------------------------------------------------');
    newPopupWindow(event, url, frameName, disposition, options, additionalFeatures, mainWindow);
  });
}

function newPopupWindow(event, url, frameName, disposition, options, additionalFeatures, win) {
  console.log('popup from main thread');
  event.preventDefault();
  Object.assign(options, {
    frame: true,
    show: false,
    backgroundColor: '#efefef',
    //parent: win,
    titleBarStyle: '',
    width: windowWidth,
    height: windowHeight,
    closable: true
  });
  Object.assign(options.webPreferences, {
    preload: '',
    isBrowserView: false,
    javascript: true
  });
  if (frameName === 'modal') {
    options.modal = true;
  }
  //event.newGuest = new BrowserWindow(options);
  let tabView;
  tabView = new BrowserView(options);
  mainWindow.addBrowserView(tabView);
  tabView.setBounds({ x: 0, y: 50, width: windowWidth, height: windowHeight - 50 });
  tabView.setAutoResize({width: true, height: true});
  console.log(tabView);
  console.log(tabStore);
  event.newGuest = tabView;
  event.newGuest.once('ready-to-show', () => {
    event.newGuest.show()
  });
  console.log(url);
  event.newGuest.webContents.loadURL(url);
  event.newGuest.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    console.log('---------------------------------------------------------------');
    newPopupWindow(event, url, frameName, disposition, options, additionalFeatures, event);
  });
  event.newGuest.on('close', (e) => {
    let c = BrowserWindow.getFocusedWindow();
    if (c !== null) {
      c.destroy();
    }
  });
  tabStore.push(tabView);
}

app.on('ready', () => {
  protocol.interceptFileProtocol('file', (request, callback) => {
    const url = request.url.substr(7);    /* all urls start with 'file://' */
    const extension = url.split('.').pop();
    let options = {path: path.normalize(`${BASE_DIR}/${url}`)};
    callback(options);
  }, (err) => {
    if (err) console.error('Failed to register protocol');
  });
  // Force mime-type to javascript
  protocol.registerBufferProtocol('es6', (req, cb) => {
    nfs.readFile(
      npjoin(es6Path, req.url.replace('es6://', '')),
      (e, b) => {
        cb({mimeType: 'text/javascript', data: b})
      }
    )
  });
  createWindow()
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (mainWindow) {
    e.preventDefault();
    mainWindow.webContents.send('app-close-window');
  }
});


app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
app.on('certificate-error', function (event, webContents, url, error,
                                      certificate, callback) {
  event.preventDefault();
  callback(true);
});
// Let windows without node integration
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('new-window', function (e, url, frameName, disposition, options, additionalFeatures) {
      newPopupWindow(e, url, frameName, disposition, options, additionalFeatures, event);
    });
  }
  /*if (contents.getType() === 'webview') {
    contents.on('new-window', function (newWindowEvent, url) {
      newWindowEvent.preventDefault();
      console.log("is it a blocking call?,", url);
      console.log(newWindowEvent);
      newWindowEvent.newGuest = newWindowEvent.sender;
    });
  }*/
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;
    webPreferences.nativeWindowOpen = true;
    //console.log(event);
    // Disable Node.js integration
    //webPreferences.nodeIntegration = false;
  });
});


function newTabWindow(event, url, frameName, disposition, options, additionalFeatures) {
  console.log('------- requested URL:', url);
  const ev = event;
  openPageURL = url;
  Object.assign(options, {
    title: "Loading...",
    frame: true,
    visible: false,
    backgroundColor: '#efefef',
    closable: true,
    src: url,
    webviewAttributes: {
      //nodeintegration: false,
      allowpopups: true,
      autosize: false,
      //webviewTag: true,
      webpreferences: defaultWebPreferences
    },
    ready: loadURLonTab
  });
  if (frameName === 'modal') {
    options.modal = true;
  }
  let newTab = tabGroup.addTab(options);
  newTab.webview.addEventListener('page-title-updated', (e) => {
    const newTitle = e.target.getTitle();
    newTab.setTitle(newTitle);
  });
  newTab.on("webview-ready", (tab) => {
    tab.show(true);
    console.log('webview ready', tab);
    //event.newGuest = tab.webview.getWebContents();
    //console.log('new guest: ', event.newGuest);
  });
  newTab.webview.addEventListener('dom-ready', (e) => {
    console.log('from event,', ev);
    console.log("new tab", e);
    e.target.openDevTools();
    //if (openPageURL !== '') {
    let newTabContents = e.target.getWebContents();
    //let newURL = openPageURL;
    //openPageURL = '';
    //e.target.loadURL(newURL);
    newTabContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
      event.preventDefault();
      newTabWindow(event, url, frameName, disposition, options, additionalFeatures);
    });
    //}
    console.log("access?,", ev.webview);
    ev.newGuest = newTabContents;
  });
  //event.newGuest = tab.webview.getWebContents();
  //event.newGuest = newTab.webview.getWebContents();
  //console.log("New window: ", newTab.webview);
  //return newTab.webview;
}
