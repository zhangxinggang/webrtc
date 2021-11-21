const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server
const g_rooms = {}
const { v4: uuidv4 } = require('uuid')
module.exports={
	init:function(options){
		const wsServer = new WebSocketServer(options)
		wsServer.on('connection', (ws) => {
			let roomInfo = this.createRoom({ws:ws}) // 每一个连接都是一个房间
		  ws.on('message', (message) => {
		    let msg = JSON.parse(message)
		    let sendToClients = true
				let roomid = msg.roomid
		    switch(msg.type) {
		      case "init"://初始化当前连接信息
		      	roomInfo.options = msg.options || {}
						roomInfo.options._roomid = msg.options.roomid || roomInfo.roomid
						this.push({
						  type: 'inited',
						  roomid: roomInfo.roomid,
							options: roomInfo.options
						})
						sendToClients = false
						break;
		      case "subscribe"://订阅房间
		        if(!roomid) return
		        let members = {}
		        members[roomInfo.roomid] = true
		        roomInfo.joins[roomid]= true
		        let params = {roomid,members}
		        if(g_rooms[roomid]){
		        	this.updateRoom(params)
		        }else{
		        	this.createRoom(params)
		        }
		        let allRoomInfo = this.getRoomInfo(roomid)
		        allRoomInfo.who = roomInfo.options
		        this.push({
		          type: 'subscribed',
		          roomid: roomid,
		        	options: allRoomInfo
		        })
		        sendToClients = false
		        break;
					case "unsubscribe"://取消订阅
					  if(!roomid || !g_rooms[roomid]) return
						this.push({
						  type: "unsubscribed",
						  roomid: roomid,
							options: roomInfo.options
						})
						delete g_rooms[roomid]['members'][roomInfo.roomid]
						delete g_rooms[roomInfo.roomid]['joins'][roomid]
						if(!Object.keys(g_rooms[roomid]['members']).length){
							this.deleteRoom({ roomid:roomid })
						}
					  sendToClients = false
					  break;
		    }
		    // 数据中转服务
		    if(sendToClients) {
		    	this.push(msg)
		    }
		  });
		  // 用户已注销或已断开连接
		  ws.on('close', ()=>{
				let roomid = roomInfo.roomid
				Object.keys(roomInfo.joins).forEach(item=>{
					let joinRoom = g_rooms[item]
					if(joinRoom){
						delete joinRoom['members'][roomid]
						if(!Object.keys(joinRoom['members']).length){
							this.deleteRoom({ roomid:item })
						}else{
							this.push({
							  type: "disconnected",
							  roomid: item,
								options: roomInfo.options
							})
						}
					}
				})
				// 删除当前用户
				delete g_rooms[roomid]
		  })
		})
	},
	/**
	 * 创建房间
	 * @param {string} roomid - 房间ID
	 * @param {object} members - 成员roomid
	 * @param {object} joins - 加入的房间roomid 
	 * @param {object} ws - websocket
	 * @param {object} options - 用户参数，message：用户传递信息
	 */
	createRoom(obj){
		let roomid = obj.roomid || uuidv4()
		g_rooms[roomid] ={
			roomid:roomid,
			members:{},
			joins:{},
			ws:null,
			options:{}
		} 
		Object.assign(g_rooms[roomid],obj)
		return g_rooms[roomid]
	},
	/** 删除房间
	 * @param {string} roomid - 房间ID
	 */
	deleteRoom(obj){
		delete g_rooms[obj.roomid]
	},
	/** 更新房间信息，参数同创建房间
	 */
	updateRoom(obj){
		let roomInfo = g_rooms[obj.roomid]
		for(let key in roomInfo){
			if(obj[key]){
				if(Object.prototype.toString.call(roomInfo[key])==="[object Object]"){
					Object.assign(roomInfo[key],obj[key])
				}else{
					roomInfo[key] = obj[key]
				}
			}
		}
	},
	getRoomInfo(roomid){
		if(!g_rooms[roomid]) return
		let members = g_rooms[roomid]['members']
		let info = {}
		info['roomid'] = roomid
		info['roomInfo'] = []
		Object.keys(members).forEach(item=>{
			g_rooms[item] && info['roomInfo'].push(g_rooms[item].options)
		})
		return info
	},
	/** 发送房间信息，参数同创建房间
	 */
	push(obj,callback){
		let cb = ()=>{
			callback && callback()
		}
		if(!g_rooms[obj.roomid]){
			cb()
			return
		}
		let members = g_rooms[obj.roomid]['members']
		let memberArr = Object.keys(members)
		memberArr = memberArr.length?memberArr:[obj.roomid]
		let promiseArr = []
		memberArr.forEach(item=>{
			if(g_rooms[item]){
				let client = g_rooms[item]['ws']
				let one = new Promise(resolve=>{
					if(client.readyState === WebSocket.OPEN){
						let haveCb = false
						//https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_writable_write_chunk_encoding_callback
						//send函数发生错误时，不一定会调用callback
						client.send(JSON.stringify(obj),function(e){
							haveCb = true
							if(e) console.error(e)
							resolve()
						})
						setTimeout(function(){
							!haveCb && resolve()
						},2000)
					}else{
						resolve()
					}
				})
				promiseArr.push(one)
			}
		})
		Promise.all(promiseArr).then(cb)
	},
	broadcast(message){
		for(let key in g_rooms){
			if(g_rooms[key]['ws']){
				g_rooms[key]['ws'].send(message)
			}
		}
	}
}