import Vue from 'vue'
import Antd from 'ant-design-vue'
import Router from 'vue-router'
import App from './App.vue'
import 'ant-design-vue/dist/antd.css'
// https://github.com/hokein/electron-sample-apps
Vue.config.productionTip = false
Vue.use(Antd)
Vue.use(Router)
new Vue({
	router:new Router(),
  render: h => h(App),
}).$mount('#app')
