namespace AspireReact.Server.Services;

public class RapidOcrOptions
{
    public string ModelsDirectory { get; set; } = "RuntimeData/RapidOcr";
    public string DetectorModelPath { get; set; } = string.Empty;
    public string RecognizerModelPath { get; set; } = string.Empty;
    public string ClassifierModelPath { get; set; } = string.Empty;
    public bool AutoDownloadModels { get; set; } = true;
}
