const { desktopCapturer } = require('electron')
window.navigator.mediaDevices.getDisplayMedia = (options) => {
  options = options || {}
  return new Promise(async (resolve, reject) => {
    try {
      // http://www.niuguwen.cn/kaifashouce-cat-138-13816.html
      if(options.mediaSource==='screen'){
        window.navigator.mediaDevices.getUserMedia({
          video: {
            mandatory: {
              chromeMediaSource: 'screen'
            }
          }
        }).then(resolve).catch(reject)
        return
      }
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      const selectionElem = document.createElement('div')
      selectionElem.style = 'position: fixed;top: 0;left: 0;background: #fff;width: 100vw;height: 100vh;overflow: overlay;'
      selectionElem.innerHTML = `
        <ul style="list-style:none;display:flex;flex-wrap:wrap;justify-content: center;padding: 30px;">
          ${sources.map(({id, name, thumbnail, display_id, appIcon}) => `
            <li class="desktop-capturer-selection_btn" data-id="${id}" title="${name}" style="margin: 16px;display: flex;justify-content: center;align-items: center;width:25%;">
              <button style="padding: 10px;width: 100%;height: 100%;display: flex;flex-direction: column;justify-content: space-between;cursor:pointer;">
                <img src="${thumbnail.toDataURL()}" style="width: calc(100% - 10px);" />
                <span style="margin-top: 10px;display: block;width: 100%;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;">${name}</span>
              </button>
            </li>
          `).join('')}
        </ul>
      `
      document.body.appendChild(selectionElem)
      document.querySelectorAll('.desktop-capturer-selection_btn')
        .forEach(button => {
          button.addEventListener('click', async () => {
            try {
              const id = button.getAttribute('data-id')
              const source = sources.find(source => source.id === id)
              if(!source) {
                reject(new Error(`Source with id ${id} does not exist`))
              }
              const stream = await window.navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                  }
                }
              })
              resolve(stream)
              selectionElem.remove()
            } catch (err) {
              console.error('Error selecting desktop capture source:', err)
              reject(err)
              button.remove()
              if(!document.querySelectorAll('.desktop-capturer-selection_btn').length){
                selectionElem.remove()
              }
            }
          })
        })
    } catch (err) {
      console.error('Error displaying desktop capture sources:', err)
      reject(err)
    }
  })
}