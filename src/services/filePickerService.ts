import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export type PickedCsvFile = {
  name?: string;
  text: string;
};

export async function pickCsvFile(): Promise<PickedCsvFile | null> {
  if (Platform.OS === "web") return pickCsvFileWeb();
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain", "application/csv", "application/vnd.ms-excel", "*/*"],
    copyToCacheDirectory: true
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  return { name: asset.name, text };
}

function pickCsvFileWeb(): Promise<PickedCsvFile | null> {
  return new Promise((resolve, reject) => {
    const web = globalThis as typeof globalThis & { document?: Document; FileReader?: typeof FileReader };
    if (!web.document || !web.FileReader) {
      reject(new Error("ファイルを開けませんでした。"));
      return;
    }
    const input = web.document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new web.FileReader!();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result ?? "") });
      reader.onerror = () => reject(new Error("ファイルを開けませんでした。"));
      reader.readAsText(file, "utf-8");
    };
    input.click();
  });
}
