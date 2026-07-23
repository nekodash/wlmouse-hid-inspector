// WLmouse Web設定ドライバの WebHID 通信を盗み見るフック。
// 使い方: WLmouse Web設定ドライバのタブで DevTools(F12) → Console を開き、
// (Chromeが貼り付けを拒否したら、先に "allow pasting" と入力してEnter) 下記を全部貼って実行。
// その後、ドライバでバッテリー表示を開く/更新、充電ケーブルを抜き挿しする。
(() => {
  const P = HIDDevice.prototype;
  const hex = v => [...new Uint8Array(v.buffer || v)].map(b => b.toString(16).padStart(2, '0')).join(' ');

  // 送信系(要求)をフック
  for (const name of ['sendReport', 'sendFeatureReport']) {
    const orig = P[name];
    P[name] = function (reportId, data) {
      console.log(`%c[TX ${name}] id=${reportId} data= ${data ? hex(data) : ''}`, 'color:#e67e22;font-weight:bold');
      return orig.apply(this, arguments);
    };
  }

  // Feature読み取り(応答)をフック
  const rf = P.receiveFeatureReport;
  P.receiveFeatureReport = function (reportId) {
    return rf.apply(this, arguments).then(dv => {
      console.log(`%c[RX feature] id=${reportId} data= ${hex(dv)}`, 'color:#27ae60;font-weight:bold');
      return dv;
    });
  };

  // open時に inputreport を監視(応答が input で返る機種向け)
  const openOrig = P.open;
  P.open = function () {
    return openOrig.apply(this, arguments).then(r => {
      console.log(`%c[open] ${this.productName} VID=0x${this.vendorId.toString(16)} PID=0x${this.productId.toString(16)}`, 'color:#2980b9');
      this.addEventListener('inputreport', e =>
        console.log(`%c[RX input] id=${e.reportId} data= ${hex(e.data)}`, 'color:#8e44ad'));
      return r;
    });
  };

  // すでに開いているデバイスにも input監視を追加
  navigator.hid.getDevices().then(ds => ds.forEach(d => {
    d.addEventListener('inputreport', e =>
      console.log(`%c[RX input*] id=${e.reportId} data= ${hex(e.data)}`, 'color:#8e44ad'));
  }));

  console.log('%cHID hooks installed. バッテリー表示の更新/充電ケーブル抜き挿しをしてログを見てください。', 'color:#fff;background:#333;padding:2px 6px');
})();
