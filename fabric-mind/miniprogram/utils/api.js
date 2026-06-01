function request(path, method = "GET", data = {}) {
  const app = getApp();
  return new Promise((resolve, reject) => {
    const url = `${app.globalData.baseUrl}${path}`;
    const header = {
      "content-type": "application/json"
    };
    if (app.globalData && app.globalData.token) {
      header["Authorization"] = `Bearer ${app.globalData.token}`;
    }

    wx.request({
      url,
      method,
      data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          if (!data._isRetry) {
            console.warn("Session expired (401), attempting silent re-login...");
            app.loginWithWechat().then(() => {
              const retryData = { ...data, _isRetry: true };
              request(path, method, retryData).then(resolve).catch(reject);
            }).catch(() => {
              reject(new Error("登录会话已过期，请尝试重新打开小程序"));
            });
            return;
          }
        }
        if (res.statusCode >= 400) {
          reject(new Error(res.data?.message || `请求失败：${res.statusCode}`));
          return;
        }
        resolve(res.data);
      },
      fail: (err) => {
        const raw = err?.errMsg || "";
        console.error("FabricMind request failed", { url, raw });
        const hint = raw.includes("url not in domain list")
          ? "开发工具未关闭合法域名校验，或真机未配置 HTTPS 合法域名"
          : raw.includes("fail")
            ? "网络连接失败，请确认服务器地址可访问"
            : "请求失败";
        reject(new Error(hint));
      }
    });
  });
}

module.exports = { request };
