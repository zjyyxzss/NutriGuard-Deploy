import axios from 'axios'

// 创建一个 Axios 实例
const service = axios.create({
  baseURL: 'http://192.168.100.129IP:8080' ,
  timeout: 60000, // 请求超时时间 (60秒，因为 LLM 可能慢)
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 在发送请求之前做些什么，例如添加 token
    // config.headers['Authorization'] = 'Bearer your_token'
    return config
  },
  error => {
    // 对请求错误做些什么
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    // 对响应数据做些什么
    return response.data // 通常直接返回响应体
  },
  error => {
    // 对响应错误做些什么
    console.error('Response error:', error)
    return Promise.reject(error)
  }
)

export default service