const { request } = require("../../utils/api");
const app = getApp();

const modePrompts = {
  "上衣试穿": "【上衣试穿】图1是人物照片，图2是服装素材。只将图2中的上衣穿到图1人物身上，只替换上半身服装区域；保留图1的裤子/裙子、鞋子、脸部、发型、体型、姿势、背景、光照和构图。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整人物照片，不要裁掉头、脚或手臂。",
  "下装试穿": "【下装试穿】图1是人物照片，图2是服装素材。只将图2中的裤子或裙子穿到图1人物身上，只替换下半身服装区域；保留图1的上衣、鞋子、脸部、发型、体型、姿势、背景、光照和构图。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整人物照片，不要裁掉头、脚或手臂。",
  "整套换装": "【整套换装】图1是人物照片，图2是完整服装/套装素材。请识别图2中的上衣和下装，并同时穿到图1人物身上，上半身和下半身都必须完整替换成图2的服装。需要覆盖并移除图1原有服装的颜色、材质和版型；如果图1原本是长袍、裙装或特殊造型，也要改成图2的上衣+裤装/下装形态，不要保留原来的橙色、灰色拼接、盔甲或裙摆结构。保留图1人物的脸部、发型、体型、姿势、背景、光照、构图和全身画面比例。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整全身照片，不要裁掉头、脚或手臂。",
  "自定义编辑": "图1是人物照片，图2是服装素材。按照我的补充要求编辑服装，同时保持人物脸部、发型、体型、姿势、背景、光照和完整画面比例不变。不要把图2的白底、商品排版、文字、边框、水印带入结果。"
};

const modeScopes = {
  "上衣试穿": "top",
  "下装试穿": "bottom",
  "整套换装": "full",
  "自定义编辑": "full"
};

const POINTS_KEY = "fabricMindPoints";
const CHECKIN_KEY = "fabricMindLastCheckInDate";
const DEFAULT_PERSON_PREVIEW = "/assets/home-person.jpg";
const DEFAULT_GARMENT_PREVIEW = "/assets/home-garment.jpg";

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    points: 128,
    checkedIn: false,
    modes: ["上衣试穿", "下装试穿", "整套换装", "自定义编辑"],
    mode: "整套换装",
    scope: "full",
    prompt: modePrompts["整套换装"],
    personUrl: DEFAULT_PERSON_PREVIEW,
    garmentUrl: DEFAULT_GARMENT_PREVIEW,
    personName: "默认人物预览",
    garmentName: "默认服装预览",
    personApiUrl: "/public/home/person-default.png",
    garmentApiUrl: "/public/home/garment-default.png",
    uploadingPerson: false,
    uploadingGarment: false
  },

  onLoad() {
    this.restoreCheckIn();
  },

  onShow() {
    this.restoreCheckIn();

    if (app.globalData.selectedGarment) {
      const g = app.globalData.selectedGarment;
      const mode = g.type === "下装" ? "下装试穿" : g.type === "整套" ? "整套换装" : g.type === "上衣" ? "上衣试穿" : this.data.mode;
      this.setData({
        garmentApiUrl: g.apiUrl,
        garmentUrl: this.resolveDisplayUrl(g.displayUrl || g.apiUrl),
        garmentName: g.name || "已选择服装素材",
        mode,
        scope: modeScopes[mode] || this.data.scope,
        prompt: modePrompts[mode] || this.data.prompt
      });
      app.globalData.selectedGarment = null;
    }

    if (app.globalData.selectedPerson) {
      const p = app.globalData.selectedPerson;
      this.setData({
        personApiUrl: p.apiUrl,
        personUrl: this.resolveDisplayUrl(p.displayUrl || p.apiUrl),
        personName: p.name || "已选择人物照片"
      });
      app.globalData.selectedPerson = null;
    }
  },

  restoreCheckIn() {
    this.setData({
      points: Number(wx.getStorageSync(POINTS_KEY) || this.data.points || 128),
      checkedIn: wx.getStorageSync(CHECKIN_KEY) === todayKey()
    });
  },

  checkIn() {
    if (this.data.checkedIn) {
      wx.showToast({ title: "今日已签到", icon: "none" });
      return;
    }
    const next = this.data.points + 5;
    wx.setStorageSync(POINTS_KEY, next);
    wx.setStorageSync(CHECKIN_KEY, todayKey());
    this.setData({ checkedIn: true, points: next });
    wx.showToast({ title: "签到 +5 积分", icon: "success" });
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      mode,
      scope: modeScopes[mode] || "full",
      prompt: modePrompts[mode] || modePrompts["自定义编辑"]
    });
  },

  onPrompt(e) {
    this.setData({ prompt: e.detail.value });
  },

  appendPrompt(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ prompt: this.data.prompt ? `${this.data.prompt}，${text}` : text });
  },

  goAssets() {
    wx.switchTab({ url: "/pages/assets/index" });
  },

  resolveDisplayUrl(url) {
    if (!url) return "";
    if (url.startsWith("/assets/")) return url;
    if (/^https?:\/\//.test(url)) return url;
    return `${app.globalData.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  },

  choosePerson() {
    this.chooseAndUpload("person");
  },

  chooseGarment() {
    this.chooseAndUpload("garment");
  },

  chooseAndUpload(kind) {
    wx.showActionSheet({
      itemList: ["从相册/文件选择", "打开相机拍照"],
      success: (actionRes) => {
        const sourceType = actionRes.tapIndex === 1 ? ["camera"] : ["album"];
        wx.chooseMedia({
          count: 1,
          mediaType: ["image"],
          sourceType,
          camera: "back",
          success: (chooseRes) => {
            const filePath = chooseRes.tempFiles[0]?.tempFilePath;
            if (filePath) this.uploadPickedFile(kind, filePath);
          }
        });
      }
    });
  },

  uploadPickedFile(kind, filePath) {
    const isPerson = kind === "person";
    this.setData({
      [isPerson ? "uploadingPerson" : "uploadingGarment"]: true,
      [isPerson ? "personUrl" : "garmentUrl"]: filePath
    });
    this.uploadPickedFileAsBase64(kind, filePath);
  },

  applyUploadResult(kind, rawData, statusCode = 200) {
    const isPerson = kind === "person";
    let data = rawData;
    if (typeof rawData === "string") {
      try {
        data = JSON.parse(rawData || "{}");
      } catch {
        wx.showToast({ title: "上传返回异常", icon: "none" });
        return false;
      }
    }
    if (Number(statusCode) >= 400 || !data.url) {
      wx.showToast({ title: data.message || "上传失败", icon: "none" });
      return false;
    }

    const displayUrl = data.displayUrl || data.ossUrl || data.localUrl || data.url;
    this.setData(isPerson
      ? { personApiUrl: data.url, personUrl: this.resolveDisplayUrl(displayUrl), personName: "本地上传人物" }
      : { garmentApiUrl: data.url, garmentUrl: this.resolveDisplayUrl(displayUrl), garmentName: "本地上传服装" });
    wx.showToast({ title: "上传成功", icon: "success" });
    return true;
  },

  uploadPickedFileAsBase64(kind, filePath) {
    const isPerson = kind === "person";
    const ext = filePath.toLowerCase().includes(".png") ? "png" : "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    wx.showLoading({ title: "上传中" });
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (fileRes) => {
        const header = { "content-type": "application/json" };
        if (app.globalData && app.globalData.token) {
          header.Authorization = `Bearer ${app.globalData.token}`;
        }
        wx.request({
          url: `${app.globalData.baseUrl}/api/uploads/temp`,
          method: "POST",
          header,
          data: {
            kind,
            filename: `${kind}.${ext}`,
            contentType,
            base64: fileRes.data
          },
          success: (requestRes) => this.applyUploadResult(kind, requestRes.data, requestRes.statusCode),
          fail: (requestError) => {
            console.error("base64 upload failed", requestError);
            wx.showToast({ title: "上传失败，请检查本地服务是否运行", icon: "none" });
          },
          complete: () => {
            wx.hideLoading();
            this.setData({ [isPerson ? "uploadingPerson" : "uploadingGarment"]: false });
          }
        });
      },
      fail: (readError) => {
        wx.hideLoading();
        this.setData({ [isPerson ? "uploadingPerson" : "uploadingGarment"]: false });
        wx.showToast({ title: readError.errMsg || "读取图片失败", icon: "none" });
      }
    });
  },

  async startGenerate() {
    wx.showLoading({ title: "提交中" });
    try {
      const resp = await request("/api/generation/try-on", "POST", {
        mode: this.data.mode,
        scope: this.data.scope,
        prompt: this.data.prompt,
        personUrl: this.data.personApiUrl,
        garmentUrl: this.data.garmentApiUrl,
        fallbackToMock: false
      });
      wx.hideLoading();
      wx.navigateTo({ url: `/pages/task/index?id=${resp.taskId}` });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || "提交失败", icon: "none" });
    }
  }
});
