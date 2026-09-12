import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { validOpeningImage } from "./settings";
import { Platform, Image } from "react-native";
import * as Picker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

export async function pickBackup(): Promise<string | null> {
  const result = await Picker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 20 * 1024 * 1024)
    throw new Error("20MB以下のバックアップを選択してください。");
  if (Platform.OS === "web") {
    if (asset.file) return asset.file.text();
    const response = await fetch(asset.uri);
    return response.text();
  }
  return FS.readAsStringAsync(asset.uri);
}
export async function saveText(
  name: string,
  text: string,
  mime = "application/json",
) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const uri = `${FS.cacheDirectory}${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await FS.writeAsStringAsync(uri, text);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("この端末では共有を利用できません。");
  await Sharing.shareAsync(uri, { mimeType: mime });
}
export async function printCard(html: string) {
  if (Platform.OS === "web") {
    const popup = window.open("", "_blank");
    if (!popup)
      throw new Error(
        "ポップアップがブロックされています。このサイトのポップアップを許可してください。",
      );
    popup.opener = null;
    popup.document.write(html);
    popup.document.close();
    return;
  }
  const file = await Print.printToFileAsync({ html, width: 595.2756, height: 841.8898, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ uri: file.uri });
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: ".pdf",
  });
}

export async function pickOpeningImage(): Promise<string | null> {
  const result = await Picker.getDocumentAsync({ type: ['image/jpeg', 'image/png'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if ((asset.size ?? asset.file?.size ?? 0) > 10 * 1024 * 1024) throw new Error('画像は10MB以下のJPEG・PNGを選択してください。');
  let source = asset.uri;
  if (Platform.OS === 'web' && asset.file) {
    source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      reader.readAsDataURL(asset.file!);
    });
  }
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(source, (width, height) => resolve({ width, height }), reject));
  if (!size.width || !size.height || size.width * size.height > 80000000) throw new Error('画像が大きすぎるか、読み込めない形式です。');
  const context = ImageManipulator.manipulate(source);
  try {
    if (Math.max(size.width, size.height) > 1600) context.resize(size.width >= size.height ? { width: 1600 } : { height: 1600 });
    const image = await context.renderAsync();
    try {
      for (const compress of [0.78, 0.6, 0.4]) {
        const output = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
        const data = `data:image/jpeg;base64,${output.base64}`;
        // Keep room for both recovery generations and the runner's saved plans.
        if (validOpeningImage(data) && data.length <= 700000) return data;
      }
      throw new Error('保存容量を確保できませんでした。小さい画像を選択してください。');
    } finally { image.release(); }
  } catch (error) {
    throw new Error(error instanceof Error ? `画像の変更に失敗しました：${error.message}` : '画像を読み込めませんでした。JPEG・PNG画像を選び直してください。');
  } finally { context.release(); }
}
