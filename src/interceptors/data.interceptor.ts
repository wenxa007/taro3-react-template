/**
 * data拦截器 处理数据格式 接口错误等
 */

import Taro from '@tarojs/taro'
import { SUCC_LIST, LOGIN_FAILURE_LIST } from '~/constants/code'
import { INTERCEPTOR_HEADER } from '~/constants/header'
import Toast from '~/utils/toast'
import Pages from '~/utils/pages'
import { logoutJumpInterval } from '~/constants/timeout'

export default function (chain) {
	console.log('enter data interceptor', chain)
	const requestParams = chain.requestParams
	const { header } = requestParams
	const { showToast } = header[INTERCEPTOR_HEADER]
	return chain.proceed(requestParams).then((res) => {
		console.log('data拦截器接收到的数据', res)

		// 先判断状态码
		if (res.statusCode !== 200) {
			// 错误处理
			console.error(`接口异常: ${res.data.path}`, res.statusCode)
			Toast.error('很抱歉，数据临时丢失，请耐心等待修复')
			// throw `很抱歉，数据临时丢失，请耐心等待修复`;
			return Promise.resolve('很抱歉，数据临时丢失，请耐心等待修复')
		}

		let resultData = { ...res.data }

		// 状态码为200时的错误处理
		// 这里主要是兼容多后台返回结果格式不规范以及后台框架设计存在问题的情况
		// 1. 返回状态码200 但返回结果是空字符串 在浏览器调试工具中查看不到任何信息
		if (!resultData) {
			throw `返回数据为空：${resultData}`;
		}


		/**
		 * 以下是针对后台接口返回结构不同的处理
		 */

		if (resultData.hasOwnProperty('error_code')) {
			// 结构为 error_code reason result resultcode 的返回数据处理

			// 2. 统一返回格式
			// code 返回编码 强转字符串
			// msg 错误信息字符串 一般用于前端错误展示
			// data 返回数据
			resultData.code = resultData.error_code.toString()
			resultData.msg = resultData.reason
			resultData.data = resultData.result
			delete resultData.error_code
			delete resultData.result
			delete resultData.reason

			// 接口返回错误code时前端错误抛出
			if (!SUCC_LIST.includes(resultData.code) && showToast ) {
				Toast.error(resultData.msg)
				return Promise.reject(`${resultData.code}:${resultData.msg}`)
			}
		} else {
			console.log('into data handle', resultData)
			// 结构为 code data msg 的返回数据处理

			// 2. 统一返回格式
			// code 返回编码 强转字符串
			// msg 错误信息字符串 一般用于前端错误展示
			// data 返回数据
			resultData.code = resultData.code ? resultData.code.toString() : resultData.code
			// 3. 接口返回错误code时前端错误抛出
			// 4. 登录失效前端逻辑处理
			if (LOGIN_FAILURE_LIST.includes(resultData.code)) {
				console.error('into login falire')

				/**
				 * 防止多个接口重复跳转登录 阈值设置为2s
				 */
				const storageTimeStamp = Taro.getStorageSync('loginFailureTimeStamp')
				Taro.setStorageSync('loginFailureTimeStamp', new Date().getTime())
				if ( !storageTimeStamp || (storageTimeStamp && ((new Date().getTime() - storageTimeStamp) > logoutJumpInterval)) ) {
					// 这里处理登录失效逻辑，如跳转登录页面
					const authPage = Pages.getPage('auth')
					Taro.navigateTo({
						url: `/${authPage}`
					})
				}
				// return Promise.reject(resultData.msg)
			} else if (!SUCC_LIST.includes(resultData.code) && showToast) {
				console.log('非登录失效的失败code', resultData)
				if (resultData.code === '50000') {
					Toast.error('系统开小差了')
				} else {
					Toast.error(resultData.msg)
				}
			}
		}
		console.error('返回之前的resultData', resultData)
		return Promise.resolve(resultData)
	})
		.catch((err) => {
			Taro.hideLoading()
			Toast.error('网络开小差了')
			return Promise.reject(err)
		})
}
