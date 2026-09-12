import { Platform } from "react-native";
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
  const file = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ uri: file.uri });
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: ".pdf",
  });
}
