import React from "react";
import axios from "axios";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import {getAuthorizationToken, setAuthorizationToken } from "~/utils/auth";

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

type CSVFileImportProps = {
  url: string;
  title: string;
};

export default function CSVFileImport({ url, title }: CSVFileImportProps) {
  const [file, setFile] = React.useState<File>();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFile(file);
    }
  };

  const removeFile = () => {
    setFile(undefined);
  };

  const uploadFile = async () => {
    try {
      if (!file) {
        console.log("No file");
        return;
      }

      // Get authorization token from localStorage
      const authorizationToken = getAuthorizationToken();
      if (!authorizationToken) {
        console.log("No Authorization Token");
      }

      // Get the presigned URL
      const response = await axios({
        method: "GET",
        url,
        params: {
          name: encodeURIComponent(file.name),
        },
        headers: {
          Authorization: `Basic ${authorizationToken}`,
        },
      });

      console.log("File to upload: ", file.name);
      console.log("Uploading to: ", response.data.url);

      const result = await fetch(response.data.url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "text/csv",
        },
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      console.log("Upload successful");
      setFile(undefined);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };
  return (
    <Box>
      <Stack spacing={2}>
        <Stack direction="column" alignItems="start">
          <Typography variant="h6">{title}</Typography>
          <Button
            size="small"
            color="warning"
            variant="contained"
            onClick={() => setAuthorizationToken("maximsemikov")}
          >
            Set token to localStorage for test
          </Button>
        </Stack>
        {!file ? (
          <Button
            component="label"
            size="small"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
          >
            Upload files
            <VisuallyHiddenInput
              type="file"
              onChange={onFileChange}
              accept={".csv"}
              multiple
            />
          </Button>
        ) : (
          <div style={{ display: "flex", gap: "6px" }}>
            <Button
              size="small"
              color="primary"
              variant="contained"
              startIcon={<DeleteIcon />}
              onClick={removeFile}
            >
              Remove file
            </Button>
            <Button
              size="small"
              color="primary"
              variant="contained"
              startIcon={<FileUploadIcon />}
              onClick={uploadFile}
            >
              Upload file
            </Button>
          </div>
        )}
      </Stack>
    </Box>
  );
}
