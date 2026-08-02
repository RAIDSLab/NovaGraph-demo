import { useEffect, useState } from "react";

import type { InputComponentProps } from "..";

import type { FileInput } from "./types";

import { Input } from "~/components/form/input";

export default function FileInputComponent({
  input,
  onChange,
}: InputComponentProps<FileInput>) {
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFile = async (newValue: File) => {
    if (!input.validate) {
      onChange({ value: newValue, success: true });
      return;
    }

    if (input.validator) {
      const validator = await input.validator(newValue);
      const isValid = validator.success;
      const message = validator.message ?? "";

      setShowError(!isValid);
      setErrorMessage(message);

      onChange({
        value: newValue,
        success: isValid,
        message,
      });
      return;
    }

    const isValid = !!newValue || !input.required;
    const message = isValid ? "" : "This field is required.";

    setShowError(!isValid);
    setErrorMessage(message);

    onChange({
      value: newValue,
      success: isValid,
      message,
    });
  };

  const handleFileOnChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    } else if (!input.required) {
      setShowError(false);
      setErrorMessage("");
      onChange({
        value: undefined,
        success: true,
        message: "",
      });
    } else {
      const errorMessage =
        "There's something wrong with uploading the file. Please try again.";
      setShowError(true);
      setErrorMessage(errorMessage);

      onChange({
        value: undefined,
        success: false,
        message: errorMessage,
      });
    }
  };

  const onClick = (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
    e.currentTarget.value = "";
  };

  useEffect(() => {
    if (input.defaultValue) {
      handleFile(input.defaultValue);
    }
  }, [input.defaultValue]);

  return (
    <>
      <Input
        id={input.id}
        type="file"
        onChange={handleFileOnChange}
        required={input.required}
        accept={input.accept}
        disabled={input.disabled}
        onClick={onClick}
      />
      {showError && errorMessage && (
        <p className="text-typography-critical xsmall-body mt-1">
          {errorMessage}
        </p>
      )}
    </>
  );
}
