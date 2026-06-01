// ENV CONFIGURATION
// "auto" uses envVersion: "develop" -> dev server, "trial"/"release" -> prod server.
// Set to "dev" or "prod" to force write a specific server base URL.
const ENV_MODE = "prod"; 
const API_BASES = {
  dev: "http://127.0.0.1:5177",
  prod: "https://api.wtu-wet.cn"
};

const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
const env = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion : "release";

let defaultBaseUrl;
if (ENV_MODE === "dev") {
  defaultBaseUrl = API_BASES.dev;
} else if (ENV_MODE === "prod") {
  defaultBaseUrl = API_BASES.prod;
} else {
  defaultBaseUrl = env === "develop" ? API_BASES.dev : API_BASES.prod;
}

App({
  globalData: {
    baseUrl: defaultBaseUrl,
    token: wx.getStorageSync("fm_user_token") || "",
    user: null,
    selectedGarment: null
  },
  onLaunch() {
    this.loginWithWechat().catch(err => {
      console.warn("Silent login failed on launch", err);
    });
  },
  loginWithWechat() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => {
          if (!code) {
            reject(new Error("获取微信登录凭证失败"));
            return;
          }
          wx.request({
            url: `${this.globalData.baseUrl}/api/auth/wechat/miniprogram-login`,
            method: "POST",
            data: { code },
            success: (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.token) {
                const token = res.data.token;
                wx.setStorageSync("fm_user_token", token);
                this.globalData.token = token;
                this.globalData.user = res.data.user;
                console.log("微信静默登录成功", res.data);
                resolve(res.data.user);
              } else {
                reject(new Error(res.data?.message || "登录接口返回错误"));
              }
            },
            fail: (err) => {
              reject(err);
            }
          });
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
});
