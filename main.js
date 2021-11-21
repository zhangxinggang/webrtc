const {app, BrowserWindow} = require('electron')
const path = require('path')
const portfinder = require('portfinder')
const wsServer = require('./wsServer')
const port = 6860
portfinder.getPort({port},(err,port)=>{
	if(!err){
		wsServer.init({port})
	}
})
function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'display-media-polyfill.js'),
      contextIsolation:false
    }
  })
  mainWindow.loadFile('view/dist/index.html')
  // mainWindow.loadURL('http://localhost:8080')
}
app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})